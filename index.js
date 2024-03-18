import memoizeWeak from "./memoizeWeak.js";
import symbol from "./symbol.js";

var Left  = new WeakMap();
var Right = new WeakMap();

var getRight = (context) => Right.get(List(context));
var getLeft  = (context) => Left.get(List(context));
var setRight = (context, value) => Right.set(List(context), value);
var setLeft  = (context, value) => Left.set(List(context), value);

var Cache = new WeakMap();
var getCache = (context) => Cache.get(context) || Cache.set(context, new Map).get(context);

/**
  * @param {Object} context
  * @param {string} name
  * @returns {WeakMap}
  */
var getStore = (context, name) => {
  var map = getCache(context);
  return map.get(name) || map.set(name, new WeakMap).get(name);
}

export var saveStore = (context, name, key) => (value) => (getStore(context, name).set(key, value), value);

export function tree (useTree, use, value) {
  var left = getLeft(this);
  if (left) return useTree.call(this, left, getRight(this), value);
  return use.call(this, value);
}

var isArray = Array.isArray;
var nIndex = (key, length) => key < 0 ? 0 : key > length ? length : key;
var fIndex = (key, length) => nIndex(key < 0 ? length + key : key, length);

var isIgnoreSlice = (start, end, length) => (start === undefined)
  || (fIndex(start) <= 0) && (end === undefined || fIndex(end) >= length);

var isEmptySlice  = (start, end, length) => (length === 0) || (end === 0) || fIndex(start) >= fIndex(end);

function _findIndexTree (call, left, right) {
  var index = left.findIndex(call);
  return saveStore(this, "findIndex", call)(index === -1 ? right.findIndex(call) : index);
}

function _findLastIndexTree (call, left, right) {
  var index = left.findLastIndex(call);
  return saveStore(this, "findLastIndex", call)(index === -1 ? right.findLastIndex(call) : index);
}

function _findTree (call, left, right) {
  var index = left.findIndex(call);
  return saveStore(this, "find", call)(index === -1 ? right.find(call) : this[index]);
}

function _filterTree (call, left, right) {
  var value = left.filter(call).concat(right.filter(call));
  return saveStore(this, "filter", call)(List(value.length === this.length ? this : value));
}

function _findLastTree (call, left, right) {
  var index = left.findLastIndex(call);
  return saveStore(this, "findLast", call)(index === -1 ? right.findLast(call) : this[index]);
}

function _mapTree (call, left, right) {
  return saveStore(this, "map", call)(left.map(call).concat(right.map(call)));
}

function _flatMapTree (call, left, right) {
  return saveStore(this, "flatMap", call)(left.flatMap(call).concat(right.flatMap(call)));
}

function _findIndex (call) {
  var findLastIndexStore = getStore(this, "findLastIndex");
  if (findLastIndexStore.has(call)) {
    var index = findLastIndexStore.get(call);
    if (index === -1) return index;
    index = this.findIndex(this, (value, key, values) => index === key || call(value, key, values));
    return saveStore(this, "findIndex", call)(index);
  }
  return saveStore(this, "findIndex", call)(this.findIndex(call));
}

function _findLastIndex (call) {
  var findIndexStore = getStore(this, "findIndex");
  if (findIndexStore.has(call)) {
    var index = findIndexStore.get(call);
    if (index === -1) return index;
    index = _findIndex.call(this, (value, key, values) => key === index || call(value, key, values));
    return saveStore(this, "findLastIndex", call)(index);
  }
  return saveStore(this, "findLastIndex", call)(this.findLastIndex(call));
}

function _find (call) {
  var index = _findIndex.call(this, call);
  return saveStore(this, "find", call)(this[index]);
}

function _findLast (call) {
  var index = _findLastIndex.call(this, call);
  return saveStore(this, "findLast", call)(this[index]);
}

function _filter (call) {
  var leftIndex = _findIndex.call(this, call);
  if (leftIndex === -1) return saveStore(this, "filter", call)(empty);
  var rightIndex = _findLastIndex.call(this, call);
  if (leftIndex === 0 && rightIndex === this.length - 1) return saveStore(this, "filter", call)(List(this));

  var value = this.filter(call);
  return saveStore(this, "filter", call)(List(value.length === this.length ? this : value));
}

function _map (call) {
  return saveStore(this, "map", call)(this.map(call));
}

function _flatMap (call) {
  return saveStore(this, "flatMap", call)(this.flatMap(call));
}

function findIndex (call) {
  var findIndexStore = getStore(this, "findIndex");
  if (findIndexStore.has(call)) return findIndexStore.get(call);
  return tree.call(this, _findIndexTree, _findIndex, call);
}

function findLastIndex (call) {
  var findLastIndexStore = getStore(this, "findLastIndex");
  if (findLastIndexStore.has(call)) return findLastIndexStore.get(call);
  return tree.call(this, _findLastIndexTree, _findLastIndex, call);
}

function find (call) {
  var findStore = getStore(this, "find");
  if (findStore.has(call)) return findStore.get(call);
  return tree.call(this, _findTree, _find, call);
}

function findLast (call) {
  var findLastStore = getStore(this, "findLast");
  if (findLastStore.has(call)) return findLastStore.get(call);
  return tree.call(this, _findLastTree, _findLast, call);
}

function filter (call) {
  var filterStore = getStore(this, "filter");
  if (filterStore.has(call)) return filterStore.get(call);
  return tree.call(this, _filterTree, _filter, call);
}

function map (call) {
  var mapStore = getStore(this, "map");
  if (mapStore.has(call)) return mapStore.get(call);
  return tree.call(this, _mapTree, _map, call);
}

function flatMap (call) {
  var flatMapStore = getStore(this, "flatMap");
  if (flatMapStore.has(call)) return flatMapStore.get(call);
  return tree.call(this, _flatMapTree, _flatMap, call);
}

function sliceTree (start, end, left, right) {
  var leftLength = left.length;
  if (start === 0) {
    end = fIndex(end, this.length);
    if (end === leftLength) return left;
    if (end < leftLength) return left.slice(end);
    return left.concat(right.slice(0, end - leftLength));
  }

  if (start < 0) start = leftLength + start;

  if (start === leftLength) return end === undefined ? right : right.slice(0, end - leftLength);
  if (start > leftLength) {
    if (end === void 0) return right.slice(start - leftLength);
    if (end < 0) end = this.length + end;
    return right.slice(start - leftLength, end - leftLength);
  }

  if (start < leftLength) {
    if (end === void 0) return left.slice(start);
    if (end < 0) end = this.length + end;
    return left.slice(start).concat(this.right.slice(0, end - leftLength));
  }
}

function slice (start, end) {
  var length = this.length;
  if (isIgnoreSlice(start, end, length)) return this;
  if (isEmptySlice(start, end, length)) return List.empty;
  var left = getLeft(this);
  if (left) return List(sliceTree.call(this, start, end, left, getRight(this)));
  var value = this.slice(start, end);
  return List(value);
}

function concat (...values) {
  switch (values.length) {
    case 0: return List(this);
    case 1: {
      var value = values[0];
      var test = value && typeof value === "object";
      var concatStore = getStore(this, "concat");
      if (test && concatStore.has(value)) return concatStore.get(value);

      if (isArray(value)) {
        if (value.length === 0) {
          var list = List(this);
          concatStore.set(value, list);
          return list;
        }

        var listValue = List(value);
        if (concatStore.has(listValue)) return concatStore.get(listValue);
        var newList = List(this.concat(listValue));
        setLeft(newList, this);
        setRight(newList, value);
        concatStore.set(value, newList);
        return newList;
      }

      var create = List(this.concat(value));
      setLeft(create, this);
      setRight(create, [value]);
      test && concatStore.set(value, create);
      return create;
    }
    default: {
      var next = [];
      var bit = -1;
      values.forEach((value) => {
        if (isArray(value)) {
          if (value.length === 0) return;
          bit = -1;
          return next.push(List(value));
        }
        if (bit > -1) return next[bit].push(value);
        bit = next.length;
        return next.push([value]);
      });

      var concatStore = getStore(this, "concat");
      if (next.length === 0) return List(this);

      var value = next.reduce((create, value) => {
        if (concatStore.has(value)) return concatStore.get(value);
        var next = List(create.concatStore(value));
        setLeft(next, create);
        setRight(next, value);
        concatStore.set(value, next);
        return next;
      }, this);

      if (value.length === length) return List(this);
      return List(value);
    }
  }
}

var reversed = new WeakMap();
function toReversed () {
  if (reversed.has(this)) return reversed.get(this);
  var left  = getLeft(this);
  var right = getRight(this);
  if (left && right) return reversed.set(this, right.toReversed().concat(left.toReversed())).get(this);
  return reversed.set(this, this.toReversed()).get(this);
}

function toSorted (call) {
  var sortedStore = getStore(this, "toSorted");
  if (sortedStore.has(call)) return sortedStore.get(call);
  return sortedStore.set(call, this.toSorted(call)).get(call);
}

var use = new Map(Object.entries({
  findIndex,
  findLastIndex,
  find,
  findLast,
  filter,
  map,
  flatMap,

  toReversed,
  toSorted,

  slice,
  concat,
}));

var matchKey = (values) => (key) => values.has(key);
var isMutation = matchKey(new Set(["push", "pop", "splice", "shift", "unshift", "sort", "reverse"]));

function get (target, key) {
  if (key === symbol) return true;
  if (isMutation(key)) return undefined;
  return use.has(key) ? use.get(key).bind(target) : target[key];
}

var empty = new Proxy([], {
  get: get,
})

var List = memoizeWeak((values) => values[symbol] ? values : values.length === 0 ? empty : new Proxy((values), {
  get: get,
}));

List.empty = empty;
List.use   = use;

var Executors = new Map();

export default new Proxy(List, {
  get: function (target, key) {
    if (Executors.has(key)) return Executors.get(key);
    if (use.has(key)) {
      var executor = (...values) => (value) => use.get(key).call(value, ...values);
      return Executors.set(key, executor).get(key);
    }
    return use.has(key) ? use.get(key) : target[key];
  },
});
