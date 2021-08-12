const importLocationEq = (lhs, rhs) => {
  return lhs.module === rhs.module && lhs.name === rhs.name;
};

const emplaceImport = (imports, {module, name}, value) => {
  if (imports[module] === undefined) imports[module] = {};
  if (imports[module][name] === undefined) {
    imports[module][name] = value;
  } else {
    throw new Error(`import ${module}.${name} already defined`);
  }
};

export {importLocationEq, emplaceImport};
