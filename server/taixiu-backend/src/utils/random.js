"use strict";

function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pickRandom(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[randInt(0, list.length - 1)];
}

function makeDice3() {
  return [randInt(1, 6), randInt(1, 6), randInt(1, 6)];
}

module.exports = {
  randInt,
  pickRandom,
  makeDice3
};

