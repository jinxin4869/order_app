const createFirestore = (initial = {}) => {
  let documents = new Map(Object.entries(initial));
  let nextId = 0;
  let tail = Promise.resolve();
  const writes = [];
  const failures = new Map();
  const failIfRequested = (path) => {
    if (!failures.has(path)) return;
    const error = failures.get(path);
    failures.delete(path);
    throw error;
  };
  const snapshot = (ref) => ({
    id: ref.id,
    ref,
    exists: documents.has(ref.path),
    data: () => documents.get(ref.path),
  });
  const reference = (path) => ({
    path,
    id: path.split("/").at(-1),
    collection: (name) => collection(path + "/" + name),
    get: async () => snapshot(reference(path)),
    set: async (value) => {
      failIfRequested(path);
      documents.set(path, value);
      writes.push({ path, value });
    },
    update: async (value) => {
      failIfRequested(path);
      if (!documents.has(path)) throw new Error("Missing document: " + path);
      documents.set(path, { ...documents.get(path), ...value });
      writes.push({ path, value });
    },
    delete: async () => documents.delete(path),
  });
  const collection = (
    path,
    filters = [],
    maximum = Infinity,
    ordering = [],
    after = null
  ) => ({
    path,
    doc: (id = "generated-" + ++nextId) => reference(path + "/" + id),
    where: (field, operator, value) =>
      collection(
        path,
        [...filters, { field, operator, value }],
        maximum,
        ordering,
        after
      ),
    orderBy: (field, direction = "asc") =>
      collection(
        path,
        filters,
        maximum,
        [...ordering, { field, direction }],
        after
      ),
    startAfter: (doc) => collection(path, filters, maximum, ordering, doc),
    limit: (count) => collection(path, filters, count, ordering, after),
    get: async () => {
      const value = (doc, field) => {
        const raw = field === "__name__" ? doc.id : doc.data()[field];
        return raw instanceof Date
          ? raw.getTime()
          : raw?.toMillis
            ? raw.toMillis()
            : raw;
      };
      const compare = (a, b) => {
        for (const { field, direction } of ordering) {
          const left = value(a, field),
            right = value(b, field);
          const result = left < right ? -1 : left > right ? 1 : 0;
          if (result) return direction === "desc" ? -result : result;
        }
        return 0;
      };
      const docs = [...documents.keys()]
        .filter(
          (key) =>
            key.startsWith(path + "/") &&
            key.split("/").length === path.split("/").length + 1
        )
        .map(reference)
        .map(snapshot)
        .filter((doc) =>
          filters.every(({ field, operator, value }) => {
            const actual = doc.data()[field];
            if (operator === "==") return actual === value;
            if (operator === ">=") return actual >= value;
            if (operator === "<=") return actual <= value;
            if (operator === "in") return value.includes(actual);
            throw new Error("Unsupported filter");
          })
        )
        .filter((doc) =>
          ordering.every(({ field }) => value(doc, field) !== undefined)
        )
        .sort(compare)
        .filter((doc) => !after || compare(doc, after) > 0)
        .slice(0, maximum);
      return { docs, size: docs.length, empty: !docs.length };
    },
    add: async (value) => {
      const ref = reference(path + "/generated-" + ++nextId);
      await ref.set(value);
      return ref;
    },
  });
  const batch = () => {
    const operations = [];
    const target = {
      set: (ref, value) => {
        operations.push(() => ref.set(value));
        return target;
      },
      create: (ref, value) => {
        operations.push(async () => {
          if (documents.has(ref.path)) throw new Error("Already exists");
          await ref.set(value);
        });
        return target;
      },
      update: (ref, value) => {
        operations.push(() => ref.update(value));
        return target;
      },
      delete: (ref) => {
        operations.push(() => ref.delete());
        return target;
      },
      commit: async () => {
        for (const operation of operations) await operation();
      },
    };
    return target;
  };
  const db = {
    collection,
    doc: reference,
    batch,
    getAll: async (...refs) => Promise.all(refs.map((ref) => ref.get())),
    runTransaction: (callback) => {
      const run = tail.then(async () => {
        const before = new Map(documents),
          writeCount = writes.length;
        const tx = batch();
        tx.get = (ref) => ref.get();
        tx.getAll = (...refs) => db.getAll(...refs);
        try {
          const result = await callback(tx);
          await tx.commit();
          return result;
        } catch (error) {
          documents = before;
          writes.splice(writeCount);
          throw error;
        }
      });
      tail = run.catch(() => {});
      return run;
    },
    seed: (path, value) => documents.set(path, value),
    read: (path) => documents.get(path),
    all: () => new Map(documents),
    writes,
    failNextWrite: (path, error = new Error("Synthetic write failure")) =>
      failures.set(path, error),
  };
  return db;
};
const fixtures = () => ({
  "restaurants/rest-test": { name: "Test restaurant", is_active: true },
  "restaurants/rest-test/tables/table-test": { status: "available" },
  "restaurants/rest-test/menu_items/item-test": {
    name_ja: "テスト料理",
    name_en: "Test dish",
    name_zh: "测试菜",
    price: 1000,
    is_available: true,
  },
});
module.exports = { createFirestore, fixtures };
