import Arrow from "./arrow";
import { Circle, Star, Polygon } from "pencil.js";
import { DrawColors } from './draw';

class DashCircle extends Circle {
    setContext(ctx) {
        super.setContext(ctx);
        ctx.setLineDash([this.options.dash, this.options.dash]);
    }
}

export function draw_symbol(container, str, _color, size)
{
  let page = +str.substr(1, 1)
  let symbol = +str.substr(2, 1);
  let color = typeof _color === 'string' ? _color : DrawColors[_color];
  let cx = size / 2;
  let cy = size / 2;
  let sym = null;

  if (page === 1) {
      if (symbol === 1) {
          // circle fill
          sym = new Circle([cx, cy], 0.8 * size / 2,
              {fill: color, stroke: "black", strokeWidth: 2});
      }
      if (symbol === 2) {
          // circle outline
          sym = new Circle([cx, cy], 0.8 * size / 2,
              {fill: "white", stroke: color, strokeWidth: 2});
      }
      if (symbol === 3) {
          // dash circle fill
          sym = new DashCircle([cx, cy], 0.8 * size / 2,
              {fill: color, stroke: "black", strokeWidth: 2, dash: 4});
      }
      if (symbol === 4) {
          // dash circle outline
          sym = new DashCircle([cx, cy], 0.8 * size / 2,
              {fill: "white", stroke: color, strokeWidth: 2, dash: 4});
      }
  }
  if (page === 2) {
      let offset = size * 0.05;
      let offset2 = size * 0.15;
      if (symbol === 1) {
          sym = new Arrow([cx, cy], [[size - cx - offset, size - cy - offset]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.3});
      }
      if (symbol === 2) {
          sym = new Arrow([cx, cy], [[size - cx - offset, -cy + offset]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.3});
      }
      if (symbol === 3) {
          sym = new Arrow([cx, cy], [[-cx + offset, -cy + offset]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.3});
      }
      if (symbol === 4) {
          sym = new Arrow([cx, cy], [[-cx + offset, size - cy - offset]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.3});
      }
      if (symbol === 5) {
          sym = new Arrow([offset2, cy], [[size - offset2 * 2, 0]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.2});
      }
      if (symbol === 6) {
          sym = new Arrow([size - offset2, cy], [[-(size - offset2 * 2), 0]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.2});
      }
      if (symbol === 7) {
          sym = new Arrow([cx, offset2], [[0, size - offset2 * 2]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.2});
      }
      if (symbol === 8) {
          sym = new Arrow([cx, size - offset2], [[0, -(size - offset2 * 2)]],
            {stroke: color, strokeWidth: 3, arrow: size * 0.2});
      }
  }
  if (page === 3) {
      // Yajilin style arrows
      let offset = size * 0.15;
      if (symbol === 1) {
          sym = new Arrow([offset, offset], [[size - offset * 2, 0]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1, arrowAngle: 45});
      }
      if (symbol === 2) {
          sym = new Arrow([size - offset, offset], [[-(size - offset * 2), 0]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1, arrowAngle: 45});
      }
      if (symbol === 3) {
          sym = new Arrow([size - offset, offset], [[0, size - offset * 2]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1});
      }
      if (symbol === 4) {
          sym = new Arrow([size - offset, size - offset], [[0, -(size - offset * 2)]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1});
      }
      if (symbol === 5) {
          sym = new Arrow([size - offset, size - offset], [[-(size - offset * 2), 0]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1});
      }
      if (symbol === 6) {
          sym = new Arrow([offset, size - offset], [[size - offset * 2, 0]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1});
      }
      if (symbol === 7) {
          sym = new Arrow([offset, size - offset], [[0, -(size - offset * 2)]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1});
      }
      if (symbol === 8) {
          sym = new Arrow([offset, offset], [[0, size - offset * 2]],
            {stroke: color, strokeWidth: 2, arrow: size * 0.1});
      }
  }
  if (page === 4) {
      if (symbol === 1) {
          sym = new Star([cx, cy], size * 0.4, 5, 0.4,
            {fill: color, stroke: "black"});
      }
      if (symbol === 2) {
          let offset = size * 0.1;
          sym = new Polygon([offset, offset],
            [[size - offset * 2, cy - offset], [0, size - offset * 2], [0, 0]],
            {fill: color});
      }
  }
  if (sym) {
      if (container.symbol)
          container.remove(container.symbol);
      container.symboltext = str;
      container.symbolcolor = _color;
      container.symbol = sym;
      container.add(sym);
  }
}