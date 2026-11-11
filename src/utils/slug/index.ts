/** A short, safe id made from a name: "Key Stage 2" becomes "keystage2". */
export const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const randomSuffix = () => Math.random().toString(36).slice(2, 7);
