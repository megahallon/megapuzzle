import { Scene, Text, Rectangle, Component, Container, Line } from "pencil.js";
import { draw_cage } from "./cage";
import { draw_path } from "./path";
import { draw_symbol } from "./symbols";
import pako from "pako";
import msgpack from "msgpack-lite";
import { isEqual, range, findLastIndex } from 'lodash';

let ctx = {};
let cell_size = 0;
let boundary_size = null;
let grid_w = null;
let grid_h = null;
let grid_left = 0;
let grid_top = 0;
let grid_bottom = 0;
let grid_right = 0;
let grid_div_width = 0;
let grid_div_height = 0;
let grid_style = "normal";
let grid_diagonals = false;
let corner_offset = 0;
let hover_offset = 0;
let symbol_page = 0;

const type_path = 1;
const type_cage = 2;

const lock_normal = 1;
const lock_corner = 2;
const lock_color = 3;
const lock_boundary = 4;

const b_corner = 1;
const b_boundary = 2;

const transparent = "rgb(0, 0, 0, 0)";
const sol_text_color = "rgb(29, 106, 229)";
const mark_color = "rgba(247, 208, 56, 0.5)";
export const DrawColors = [
    "rgba(0, 0, 0, 1)",
    "rgba(207, 207, 207, 0.5)",
    "rgba(255, 255, 255, 1)",
    "rgba(163, 224, 72, 0.5)",
    "rgba(210, 59, 231, 0.5)",
    "rgba(235, 117, 50, 0.5)",
    "rgba(226, 38, 31, 0.5)",
    "rgba(247, 208, 56, 0.5)",
    "rgba(52, 187, 230, 0.5)"];

let current_color = 0;
let current_mode = "normal";
let current_style = null;
let solve_mode = false;
let scene = null;
let matrix = [];
let stuff = [];
let drag = false;
let undo_stack = [];
let current = null;
let outer = null;
let underlay = null;
let shift = false;
let cursor = null;
let boundary = null;
let grid_lines = [];

function reset() {
    matrix = [];
    stuff = [];
    undo_stack = [];
    current = null;
    outer = null;
    underlay = null;
    shift = false;
    cursor = null;
}

const textOptions = {
    font: "sans-serif",
    cursor: Component.cursors.pointer
};
const centerTextOptions = {
    font: "sans-serif",
    fill: sol_text_color,
    cursor: Component.cursors.pointer
};
const cornerTextOptions = {
    font: "sans-serif",
    fill: sol_text_color,
    cursor: Component.cursors.pointer
};
const cageCornerTextOptions = {
    font: "sans-serif",
    fill: "black",
    cursor: Component.cursors.pointer
};

class Text2 extends Text
{
    makePath(ctx) {
        const origin = this.getOrigin();
        ctx.translate(origin.x, origin.y);

        this.path = new window.Path2D();
        this.path.rect(0, 0, this.width, this.height);

        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.fill(this.path);
        ctx.fillStyle = this.options.fill.toString(ctx);

        ctx.translate(-origin.x, -origin.y);

        super.makePath(ctx);

        return this;
    }
}

export function DrawSetSymbolPage(page)
{
    symbol_page = page;
}

function set_symbol(container, str, color, _size)
{
    let text;
    let size = _size;
    if (container.normal) {
        size = cell_size;
        text = container.normal;
        container = container.symcont;
    }
    else if (size > 0) {
        // Symbol page
        color = "gray";
    }
    else {
        size = boundary_size;
        text = container.text;
    }
    if (str[0] === "#") {
        draw_symbol(container, str, color, size);
    }
    else {
        text.text = str;
    }
}

export function DrawSymbol(element, page, num, size)
{
    let sc = new Scene(element);
    set_symbol(sc, "#" + page + num, current_color, size);
    sc.render();
}

function _set_cell(lock, pos, mode, color, newtext)
{
    let x = pos[0];
    let y = pos[1];
    let b = null;
    if (pos.length === 3)
        b = get(...pos);
    let m = get(x, y);
    let undo_entry = {
        mode: mode,
        x: x, y: y,
        newtext: newtext,
        old_normal: m.normal.text
    };

    if (!m.main_grid && mode !== "normal" && !lock) {
        return;
    }
    if (m.lock_type === lock_normal && !lock && mode !== "color") {
        return;
    }

    if (mode === "reset") {
        m.center.text = "";
        m.normal.text = "";
        m.cage_corner.text = "";
        m.corner.forEach(t => t.text = "");
        m.side.forEach(t => t.text = "");
        m.r_color.options.fill = null;
        if (lock) {
            m.r_color_set.options.fill = null;
            m.fill = -1;
            if (m.symcont.symbol) {
                m.symcont.remove(m.symcont.symbol);
                m.symcont.symbol = null;
            }
            m.lock_type = 0;
        }
    }
    else if (b) {
        if (!b.text) {
            b.text = new Text([(cell_size * 0.3) / 4, 0], "", textOptions);
            b.text.options.fontSize = cell_size * 0.3;
            b.add(b.text);
        }
        set_symbol(b, newtext, color);
    }
    else if (mode === "normal") {
        if (!lock) {
            m.normal.options.fill = sol_text_color;
        }
        else {
            m.lock_type = (newtext !== "") ? lock_normal : 0;
            if (newtext[0] != "#") {
              m.normal.options.fill = DrawColors[color];
              m.color = color;
            }
        }
        // multinum && newtext !== "" m.normal.text += newtext
        set_symbol(m, newtext, color);
        if (newtext[0] != "#") {
          const meas = Text.measure(m.normal.text, m.normal.text.options);
          m.normal.position.x = (cell_size - 2.5 * meas.width) / 2;
          m.normal.position.y = cell_size * 0.15;
          m.center.text = "";
          m.corner.forEach(t => { t.text = ""; });
          m.side.forEach(t => { t.text = ""; });
        }
    }
    else if (mode === "center" && m.normal.text === "") {
        let current = m.center.text;
        let center = "";
        m.center.options.fill = sol_text_color;
        if (newtext !== "") {
            for (let i = 1; i <= 9; ++i) {
                if ((current.indexOf(i) === -1 && i === +newtext)
                    || (current.indexOf(i) !== -1 && i !== +newtext)) {
                    center += i;
                }
            }
        }

        m.center.text = center;
        const meas = Text.measure(center, m.center.options);
        m.center.position.x = (cell_size - meas.width) / 2;
        m.center.position.y = (cell_size - meas.height) / 2;
    }
    else if (mode === "set_corner") {
        if (newtext === "")
            m.cage_corner.text = "";
        else
            m.cage_corner.text += newtext;
        m.lock_type = (newtext !== "") ? lock_corner : 0;
    }
    else if (mode === "corner" && m.normal.text === "") {
        let current = "";
        m.corner.forEach(t => { current += t.text; });
        m.side.forEach(t => { current += t.text; });
        let text = "";
        if (newtext !== "") {
            for (let i = 1; i <= 9; ++i) {
                if ((current.indexOf(i) === -1 && i === +newtext)
                    || (current.indexOf(i) !== -1 && i !== +newtext)) {
                    text += i;
                }
            }
        }
        let i = 0;
        m.corner.forEach(t => { t.text = text[i++] || ""; });
        m.side.forEach(t => { t.text = text[i++] || ""; });
    }
    else if (mode === "color") {
        if (!lock) {
            m.r_color.options.fill = DrawColors[color];
        }
        else {
            m.r_color_set.options.fill = DrawColors[color];
            m.fill = color;
        }
    }
    undo_entry.normal = m.normal.text;
    undo_stack.push(undo_entry);
}

function keyup(event) {
    if (event.key === "Shift") {
        shift = false;
    }
}

function set_cell(pos, mode, color, newtext) {
    let lock = !solve_mode;
    _set_cell(lock, pos, mode, color, newtext);
}

function lock_cell(pos, mode, color, newtext) {
    _set_cell(true, pos, mode, color, newtext);
}

export function DrawSetNumber(number) {
  let count = 0;
  let symbol = number;
  if (symbol_page > 0)
    symbol = "#" + symbol_page + number;
  if (boundary) {
      set_cell(boundary, "boundary", current_color, symbol);
  }
  else {
      each_mark(m => {
          set_cell([m.x, m.y], current_mode, current_color, symbol);
          ++count;
      });
      if (count > 1)
          undo_stack.push({mode: 'group', count: count});
  }
  scene.render();
}

export function DrawSetColor(color_index) {
  current_color = color_index;
  if (current_mode === "color") {
    each_mark(m => {
        set_cell([m.x, m.y], "color", color_index, null);
    });
    scene.render();
  }
}

function keydown(event) {
    if (event.target.tagName === "TEXTAREA") {
      return;
    }

    let newtext;
    if (event.key === "Shift") {
        shift = true;
        return;
    }
    else if (event.key === "Delete" || event.key === "Backspace") {
        DrawDelete();
        event.preventDefault();
        return;
    }
    else if (event.key >= "0" && event.key <= "9") {
        newtext = event.key;
        if (symbol_page > 0)
          newtext = "#" + symbol_page + newtext;
    }
    else if (event.key >= "a" && event.key <= "z" && !solve_mode) {
        newtext = event.key;
    }
    else if (event.key >= "A" && event.key <= "Z" && !solve_mode) {
        newtext = event.key;
    }
    else if (event.key.startsWith("Arrow") && cursor) {
        let c = cursor.slice();
        if (!shift)
            unmark();
        cursor = c;
        if (event.key === "ArrowUp" && cursor[1] > 0)
            cursor[1] -= 1;
        if (event.key === "ArrowDown" && cursor[1] < grid_h - 1)
            cursor[1] += 1;
        if (event.key === "ArrowLeft" && cursor[0] > 0)
            cursor[0] -= 1;
        if (event.key === "ArrowRight" && cursor[0] < grid_w - 1)
            cursor[0] += 1;
        mark(cursor[0], cursor[1]);
        scene.render();
        return;
    }
    else {
        return;
    }

    if (boundary) {
        set_cell(boundary, "boundary", current_color, newtext);
    }
    else {
        let count = 0;
        each_mark(m => ++count);
        each_mark(m => {
            if (current_mode === "color") {
                let color = +newtext - 1;
                if (color >= 0 && color <= 9)
                    set_cell([m.x, m.y], current_mode, color, null);
            }
            else
                set_cell([m.x, m.y], current_mode, current_color, newtext);
        });
        if (count > 1)
            undo_stack.push({mode: 'group', count: count});
    }
    scene.render();
}

function get(x, y, b) {
    if (x < 0 || y < 0 || x >= grid_w || y >= grid_h) {
        return null;
    }
    let m = matrix[y][x];
    if (b >= 0)
        return m.boundary[b];
    return m;
}

function mark(x, y) {
    let m = get(x, y);
    if (!m.mark) {
        m.mark = true;
        m.rect.options.fill = mark_color;
        return true;
    }
    return false;
}

function inner_hover(x, y) {
    if (!drag) return;

    if (current_mode === "path") {
        current.objs.forEach(o => o.parent.remove(o));
        current.cells.push([x, y]);
        current.objs = draw_path(ctx, current.cells, current_style, current_color);
        scene.render();
    }
}

function move(event, x, y) {
    if (!drag) return;

    if (current_mode === "edge") {
        let m = get(x, y);
        let xp = event.position.x - outer.position.x - m.pos[0];
        let yp = event.position.y - outer.position.y - m.pos[1];
        if ((xp < cell_size * 0.4 || xp > cell_size * 0.6) && yp > cell_size * 0.4 && yp < cell_size * 0.6) {
            if (xp < cell_size * 0.4)
                m = get(x - 1, y);
            let edge = new Line(
                [cell_size, 0], [[0, cell_size]],
                {fill: null, strokeWidth: 3, stroke: "black"});
            m.edge_right.add(edge);
            scene.render();
        }
        else if ((yp < cell_size * 0.4 || yp > cell_size * 0.6)
                && xp > cell_size * 0.4 && xp < cell_size * 0.6) {
            if (yp < cell_size * 0.4)
                m = get(x, y - 1);
            let edge = new Line(
                [0, cell_size], [[cell_size, 0]],
                {fill: null, strokeWidth: 3, stroke: "black"});
            m.edge_bottom.add(edge);
            scene.render();
        }
    }
}

function hover(x, y) {
    if (!drag) return;

    if (current_mode === "path" || current_mode === "edge") {
    } else if (current_mode === "cage") {
        if (current.objs)
            current.objs.forEach(l => l.parent.remove(l));
        current.cells.push([x, y]);
        current.objs = draw_cage(ctx, current.cells, current_style);
        scene.render();
    } else {
        if (mark(x, y))
            scene.render();
    }
}

function mark_boundary(x, y, i)
{
    unmark();

    let b = get(x, y).boundary[i];
    b.options.stroke = "red";
    b.options.strokeWidth = 1;
    boundary = [x, y, i];
}

function unmark() {
    if (boundary) {
        get(...boundary).options.strokeWidth = 0;
        boundary = null;
    }
    each_mark(m => {
        m.rect.options.fill = "rgba(255, 255, 255, 0)";
        m.mark = false;
    });
    cursor = null;
}

function boundary_mousedown(event, x, y, i) {
    mark_boundary(x, y, i);
    scene.render();
}

function mousedown(event, x, y) {
    if (!shift)
        unmark();

    if (boundary) {
        get(...boundary).options.strokeWidth = 0;
        boundary = null;
    }

    cursor = [x, y];
    drag = true;

    if (current_mode === "path") {
        current = {cells: [[x, y]], color: current_color};
        current.objs = draw_path(ctx, current.cells, current_style, current_color);
    }
    else if (current_mode === "cage") {
        current = {cells: [x, y]};
        current.objs = draw_cage(ctx, current.cells, current_style);
    }
    else if (current_mode === "edge") {
    }
    else {
        mark(x, y);
    }

    scene.render();
}

function mouseup() {
    drag = false;
    if (current_mode === "path" && current) {
        stuff.push({type: type_path, style: current_style,
          cells: current.cells, objs: current.objs, color: current_color});
        current = null;
    }
    else if (current_mode === "cage" && current) {
        stuff.push({type: type_cage, style: current_style,
          cells: current.cells, objs: current.objs});
        current = null;
    }
}

export function DrawSetMode(state) {
    current_mode = state.mode;
    solve_mode = state.solveMode;
    if (state.mode === "cage")
        current_style = state.cageStyle;
    if (state.mode === "path")
        current_style = state.pathStyle;
    if (state.mode === "number" && state.numberStyle === "normal") {
        current_mode = "normal"
        each_cell(m => m.boundary.forEach(c => c.options.fill = null));
    }
    if (state.mode === "number" && state.numberStyle === "corner") {
        current_mode = "boundary"
        //mark_boundary(0, 0, 0);
        each_cell(m => m.boundary.forEach(
            b => b.options.fill = b.btype === b_corner ? transparent : null));
    }
    if (state.mode === "number" && state.numberStyle === "boundary") {
        current_mode = "boundary"
        //mark_boundary(0, 0, 0);
        each_cell(m => m.boundary.forEach(
            b => b.options.fill = b.btype === b_boundary ? transparent : null));
    }
    scene.render();
}

class DashLine extends Line {
    setContext(ctx) {
        super.setContext(ctx);
        ctx.setLineDash([this.options.dash, this.options.dash]);
    }
}

function each_cell(f) {
    for (let x = 0; x < grid_w; ++x) {
        for (let y = 0; y < grid_h; ++y) {
            let m = get(x, y);
            f(m);
        }
    }
}

function each_mark(f) {
    for (let x = 0; x < grid_w; ++x) {
        for (let y = 0; y < grid_h; ++y) {
            let m = get(x, y);
            if (m.mark)
                f(m);
        }
    }
}

function load_size(base64)
{
    let pack = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    let unpack = pako.inflate(pack);
    let data = msgpack.decode(unpack);

    if (data.version !== 1) {
        alert("Bad version");
    }

    cell_size = data.grid[0];
    grid_w = data.grid[1];
    grid_h = data.grid[2];
    grid_left = data.grid[3];
    grid_right = data.grid[4];
    grid_top = data.grid[5];
    grid_bottom = data.grid[6];
    grid_div_width = data.grid[7];
    grid_div_height = data.grid[8];
    grid_style = data.grid[9];
    grid_diagonals = data.grid[10];
}

function load(base64)
{
    let pack = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    let unpack = pako.inflate(pack);
    let data = msgpack.decode(unpack);

    stuff = [];
    each_cell(m => {
        m.lock_type = 0;
        m.normal.text = "";
        m.center.text = "";
    });

    data.cells.forEach(c => {
        let [pos, type, text, color] = c;
        if (type === lock_normal) {
            lock_cell(pos, "normal", color, text);
        }
        else if (type === lock_corner) {
            lock_cell(pos, "set_corner", color, text);
        }
        else if (type === lock_color) {
            lock_cell(pos, "color", color, text);
        }
        else if (type === lock_boundary) {
            lock_cell(pos, "boundary", color, text);
        }
    });
    data.stuff.forEach(_s => {
        let s = {type: _s[0], style: _s[1], color: _s[2], cells: _s[3]};
        if (s.type === type_path) {
            s.objs = draw_path(ctx, s.cells, s.style, s.color);
        }
        else if (s.type === type_cage) {
            s.objs = draw_cage(ctx, s.cells, s.style);
        }
        stuff.push(s);
    });
}

export function DrawGetDescription(base64)
{
    let pack = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    let unpack = pako.inflate(pack);
    let data = msgpack.decode(unpack);

    return data.desc;
}

export function DrawGenerateUrl(description)
{
    let out = {
        version: 1,
        grid: [cell_size, grid_w, grid_h, grid_left, grid_right, grid_top, grid_bottom,
               grid_div_width, grid_div_height, grid_style, grid_diagonals],
        cells: [],
        stuff: stuff.map(e => [e.type, e.style, e.color, e.cells]),
        desc: description
    };

    each_cell(m => {
        let pos = [m.x, m.y];
        if (m.lock_type === lock_normal) {
            if (m.normal.text !== "")
                out.cells.push([pos, m.lock_type, m.normal.text, m.color]);
            if (m.symcont.symboltext !== "" && m.symcont.symboltext !== undefined)
                out.cells.push([pos, m.lock_type, m.symcont.symboltext, m.symcont.symbolcolor]);
        }
        if (m.lock_type === lock_corner)
            out.cells.push([pos, m.lock_type, m.cage_corner.text, m.color]);
        if (m.fill >= 0) {
            out.cells.push([pos, lock_color, null, m.fill]);
        }
        m.boundary.forEach((b, i) => {
            if (b.symboltext)
                out.cells.push([[m.x, m.y, i], lock_boundary, b.symboltext, b.symbolcolor]);
        });
    });

    console.log(out);

    let coded = msgpack.encode(out);
    let packed = pako.deflate(coded);
    let base64 = btoa(String.fromCharCode(...packed));
    return window.location.origin + "/?s=1&p=" + encodeURIComponent(base64);
}

export function DrawCheck() {
    let r = range(1, 10);
    let rows = Array.from({length: 9}, () => []);
    let columns = Array.from({length: 9}, () => []);
    let boxes = Array.from({length: 9}, () => []);
    let missing = null;
    each_cell(m => {
        let x = m.x - grid_left;
        let y = m.y - grid_top;
        let n = +m.normal.text;
        if (n === 0 && missing === null) {
          missing = `Missing entry at ${x + 1}, ${y + 1}`;
        }
        columns[x].push(n);
        rows[y].push(n);
        let b = Math.floor(x / 3) + Math.floor(y / 3) * 3;
        boxes[b].push(n);
    });
    if (missing) {
        alert(missing);
        return false;
    }
    for (let i = 0; i < 9; ++i) {
        if (!isEqual(rows[i].sort(), r)) {
            alert(`Bad row ${i + 1}`);
            return false;
        }
        if (!isEqual(columns[i].sort(), r)) {
            alert(`Bad column ${i + 1}`);
            return false;
        }
        if (!isEqual(boxes[i].sort(), r)) {
            alert(`Bad box ${i + 1}`);
            return false;
        }
    }
    alert('OK');
    return true;
}

export function DrawDelete() {
    if (!solve_mode) {
        let i = findLastIndex(stuff, s => s.cells.find(c => c[0] === cursor[0] && c[1] === cursor[1]));
        if (i !== -1) {
            stuff[i].objs.forEach(l => l.parent.remove(l));
            stuff.splice(i, 1);
            scene.render();
            return;
        }
    }

    let count = 0;

    if (boundary) {
        set_cell(boundary, "boundary", null, "");
    }
    else {
        each_mark(m => {
            set_cell([m.x, m.y], "reset", null, "");
            ++count;
        });
    }

    if (count > 1) {
      undo_stack.push({mode: 'group', count: count});
    }

    scene.render();
}

export function DrawReset() {
    each_cell(m => {
        set_cell([m.x, m.y], "reset", null, "");
    });

    if (!solve_mode) {
      stuff.forEach(s => s.objs.forEach(l => l.parent.remove(l)));
      stuff = [];
    }
    scene.render();
}

export function DrawUndo() {
    if (undo_stack.length === 0)
        return;
    let u = undo_stack.pop();
    let count = 0;
    if (u.mode === "group") {
        count = u.count;
        u = undo_stack.pop();
    }
    do {
        if (u.mode === "normal") {
            set_cell([u.x, u.y], u.mode, current_color, u.old_normal);
        }
        else if (u.mode === "center" || u.mode === "corner") {
            set_cell([u.x, u.y], u.mode, current_color, u.newtext);
        }
        undo_stack.pop();
        --count;
        if (count > 0) {
            u = undo_stack.pop();
        }
    } while (count > 0);
    scene.render();
}

function add_grid(layer) {
    let dash = grid_style === "dash" ? 4 : 0;

    let thin = {
        fill: null,
        stroke: "black",
        strokeWidth: 1,
        dash: dash
    };
    let fat = {
        fill: null,
        stroke: "black",
        strokeWidth: 4
    };

    layer.remove(...grid_lines);

    let frame_w = grid_w - grid_left - grid_right;
    let frame_h = grid_h - grid_top - grid_bottom;

    grid_lines = [];
    if (grid_diagonals) {
        let diagonal = {
            stroke: DrawColors[1],
            strokeWidth: 4,
        };
        grid_lines.push(new Line([grid_left * cell_size, grid_top * cell_size],
            [[frame_w * cell_size, frame_h * cell_size]], diagonal));
        grid_lines.push(new Line([(grid_w - grid_right) * cell_size, grid_top * cell_size],
            [[-frame_w * cell_size, frame_h * cell_size]], diagonal));
    }

    for (let x = 0; x <= frame_w; ++x) {
        grid_lines.push(new DashLine(
            [(grid_left + x) * cell_size, grid_top * cell_size], [[0, frame_h * cell_size]],
            (x % grid_div_width) === 0 ? fat : thin));
    }
    for (let y = 0; y <= frame_h; ++y) {
        grid_lines.push(new DashLine(
            [grid_left * cell_size, (grid_top + y) * cell_size], [[frame_w * cell_size, 0]],
            (y % grid_div_height) === 0 ? fat : thin));
    }

    grid_lines.push(new Rectangle([grid_left * cell_size, grid_top * cell_size],
        frame_w * cell_size, frame_h * cell_size, fat));

    layer.add(...grid_lines);
}

export function DrawRender(code, wrapper, state) {
    cell_size = state.cellSize;
    grid_left = state.left;
    grid_right = state.right;
    grid_top = state.top;
    grid_bottom = state.bottom;
    grid_w = grid_left + state.width + grid_right;
    grid_h = grid_top + state.height + grid_bottom;
    grid_div_width = state.gridDivWidth;
    grid_div_height = state.gridDivHeight;
    grid_style = state.gridDashed ? "dash" : "normal";
    grid_diagonals = state.gridDiagonals;

    if (code)
        load_size(code);

    corner_offset = cell_size * 0.08;
    hover_offset = cell_size * 0.2;

    let wrapper_clone = wrapper.cloneNode(false);
    wrapper.parentNode.replaceChild(wrapper_clone, wrapper);
    wrapper_clone.style.width = (cell_size * grid_w + 20) + "px";
    wrapper_clone.style.height = (cell_size * grid_h + 250) + "px";
    scene = new Scene(wrapper_clone);
    scene.on("keyup", (event) => keyup(event));
    scene.on("mouseup", () => mouseup());
    reset();

    const outer_w = cell_size * grid_w;
    const outer_x = (scene.size.x - outer_w) / 2;
    const outer_y = 20;
    const options = {
        fill: "rgba(255, 255, 255, 0)",
        stroke: "black",
        strokeWidth: 1,
        cursor: Component.cursors.pointer
    };
    const boptions = {
        fill: "rgba(255, 255, 255, 0)",
        stroke: "blue",
        strokeWidth: 0,
        cursor: Component.cursors.pointer
    };
    const options_inner = {
        fill: "rgba(255, 255, 255, 0)",
        cursor: Component.cursors.pointer
    };

    textOptions.fontSize = cell_size * 0.8;
    centerTextOptions.fontSize = cell_size * 0.3;

    outer = new Container([outer_x, outer_y]);
    scene.add(outer);

    underlay = new Container([0, 0]);
    let underlay2 = new Container([0, 0]);
    let gridlayer = new Container([0, 0]);
    let overlay = new Container([0, 0]);
    outer.add(underlay2, underlay, gridlayer, overlay);

    for (let y = 0; y < grid_h; ++y) {
        matrix[y] = [];
    }
    let cs = cell_size;
    boundary_size = cell_size * 0.3;
    let bsize = boundary_size;

    for (let x = 0; x < grid_w; ++x) {
        for (let y = 0; y < grid_h; ++y) {
            let xp = x * cs;
            let yp = y * cs;
            let main_grid = (x >= grid_left && y >= grid_top
              && x < (grid_w - grid_right) && y < (grid_h - grid_bottom));
            let ocont = new Container([xp, yp]);
            let cont = new Container([xp, yp]);
            let symcont = new Container([xp, yp]);
            options.strokeWidth = 0;
            let r = new Rectangle([0, 0], cs, cs, options);
            let edge_right = new Rectangle([0, 0], cs, cs, options);
            let edge_bottom = new Rectangle([0, 0], cs, cs, options);
            let r_color = new Rectangle([0, 0], cs, cs, options);
            let r_color_set = new Rectangle([0, 0], cs, cs, options);
            let r_hover = new Rectangle(
                [hover_offset, hover_offset],
                cs - hover_offset * 2,
                cs - hover_offset * 2, options_inner);
            let normal = new Text([0, cs * 0.5], "", textOptions);
            let center = new Text([0, cs * 0.4], "", centerTextOptions);
            let corner_pos = [];
            corner_pos[0] = [corner_offset, corner_offset];
            corner_pos[1] = [cs - corner_offset, corner_offset];
            corner_pos[2] = [cs - corner_offset, cs - corner_offset];
            corner_pos[3] = [corner_offset, cs - corner_offset];
            let side_pos = [];
            side_pos[0] = [cs / 2, corner_offset];
            side_pos[1] = [cs - corner_offset, cs / 2];
            side_pos[2] = [cs / 2, cs - corner_offset];
            side_pos[3] = [corner_offset, cs / 2];
            let center_pos = [cs / 2, cs / 2];

            let cage_corner = [];
            let corner = [];
            let boundary = [];
            if (main_grid) {
                cornerTextOptions.fontSize = cs * 0.25;
                cageCornerTextOptions.fontSize = cs * 0.25;
                corner_pos.forEach((p, i) => {
                    p = p.slice(0);
                    p[0] -= cs * 0.025;
                    p[1] -= cs * 0.025;
                    if (i === 2 || i === 3) p[1] -= cs * 0.15;
                    if (i === 1 || i === 2) p[0] -= cs * 0.1;
                    if (i === 0)
                        cage_corner.push(new Text2(p, "", cageCornerTextOptions));
                    corner.push(new Text(p, "", cornerTextOptions));
                });
                boundary.push(new Rectangle([corner_offset, corner_offset], bsize, bsize, boptions));
                boundary.push(new Rectangle([cs - bsize - corner_offset, corner_offset], bsize, bsize, boptions));
                boundary.push(new Rectangle([corner_offset, cs - bsize - corner_offset], bsize, bsize, boptions));
                boundary.push(new Rectangle([cs - bsize - corner_offset, cs - bsize - corner_offset],
                    bsize, bsize, boptions));

                boundary.push(new Rectangle([-bsize / 2, -bsize / 2], bsize, bsize, boptions));
                boundary.push(new Rectangle([-bsize / 2, cs / 2 - bsize / 2], bsize, bsize, boptions));
                boundary.push(new Rectangle([cs / 2 - bsize / 2, -bsize / 2], bsize, bsize, boptions));
                if (x === grid_w - grid_right - 1) {
                    boundary.push(new Rectangle([cs - bsize / 2, -bsize / 2], bsize, bsize, boptions));
                    boundary.push(new Rectangle([cs - bsize / 2, cs / 2 - bsize / 2], bsize, bsize, boptions));
                }
                if (y === grid_h - grid_bottom - 1) {
                    boundary.push(new Rectangle([-bsize / 2, cs - bsize / 2], bsize, bsize, boptions));
                    boundary.push(new Rectangle([cs / 2 - bsize / 2, cs - bsize / 2], bsize, bsize, boptions));
                    boundary.push(new Rectangle([cs - bsize / 2, cs - bsize / 2], bsize, bsize, boptions));
                }
                boundary.forEach((b, i) => {
                    if (i < 4)
                        b.btype = b_corner;
                    else
                        b.btype = b_boundary;
                });
                if (!solve_mode)
                    boundary.forEach((b, i) => b.on("mousedown", (event) => boundary_mousedown(event, x, y, i)));
            }
            let side = [];
            if (main_grid) {
                side_pos.forEach((p, i) => {
                    p = p.slice(0);
                    p[0] -= cs * 0.02;
                    p[1] -= cs * 0.02;
                    if (i === 2) p[1] -= cs * 0.15;
                    if (i === 1 || i === 3) p[1] -= cs * 0.05;
                    if (i === 0 || i === 2) p[0] -= cs * 0.02;
                    if (i === 1) p[0] -= cs * 0.1;
                    side.push(new Text(p, "", cornerTextOptions));
                });
            }

            let r_corner = [];
            r_corner[0] = [0, 0];
            r_corner[1] = [cs, 0];
            r_corner[2] = [cs, cs];
            r_corner[3] = [0, cs];
            let corner_ext_pos = [];
            corner_ext_pos[0] = [0, corner_offset];
            corner_ext_pos[1] = [corner_offset, 0];
            corner_ext_pos[2] = [cs - corner_offset, 0];
            corner_ext_pos[3] = [cs, corner_offset];
            corner_ext_pos[4] = [cs, cs - corner_offset];
            corner_ext_pos[5] = [cs - corner_offset, cs];
            corner_ext_pos[6] = [corner_offset, cs];
            corner_ext_pos[7] = [0, cs - corner_offset];
            /*
            cont.add(r_color_set, r_color, r,
                     edge_right, edge_bottom, r_hover, normal, center,
                     ...cage_corner, ...corner, ...side);
                     */
            cont.add(r_color_set, r_color, r, r_hover, normal, center);
            cont.on("mousedown", (event) => mousedown(event, x, y));
            cont.on("hover", () => hover(x, y));
            cont.on("mousemove", (event) => move(event, x, y));
            r_hover.on("hover", () => inner_hover(x, y));
            matrix[y][x] = {
                x: x, y: y, pos: [xp, yp], symcont: symcont, cont: cont, rect: r,
                boundary: boundary,
                fill: -1, color: null,
                normal: normal, center: center,
                r_corner_pos: r_corner,
                corner: corner, side: side,
                corner_pos: corner_pos, center_pos: center_pos,
                side_pos: side_pos,
                corner_ext_pos: corner_ext_pos,
                cage_corner: cage_corner[0],
                edge_right: edge_right,
                edge_bottom: edge_bottom,
                r: r, r_color_set: r_color_set,
                r_color: r_color, main_grid: main_grid
            };
            //underlay2.add(symcont);
            underlay.add(symcont, cont);
            ocont.add(...corner, ...boundary);
            overlay.add(ocont);
        }
    }

    add_grid(gridlayer);

    ctx.scene = scene;
    ctx.underlay = underlay;
    ctx.underlay2 = underlay2;
    ctx.cell_size = cell_size;
    ctx.corner_offset = corner_offset;
    ctx.boundary_size = boundary_size;
    ctx.each_cell = each_cell;
    ctx.get = get;

    if (code)
        load(code);

    scene.render();

    return null;
}

window.addEventListener("keydown", (event) => keydown(event));
