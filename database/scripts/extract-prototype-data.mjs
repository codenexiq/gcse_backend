// Reads the sample data out of the Educate Cloud prototype (the HTML file) and writes it to database/seed/prototype-data.json,
// exactly as it is in the prototype. The demo seed uses that file. Run:  node database/scripts/extract-prototype-data.mjs "<path to the HTML>"
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const file = process.argv[2];
if (!file) throw new Error('Give the path to the prototype HTML file, e.g. node database/scripts/extract-prototype-data.mjs "E:/gcse_cloud/Educate Cloud Prototype.html"');
const html = fs.readFileSync(file, "utf8");

const between = (from, to) => {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`Could not find the part between "${from}" and "${to}"`);
  return html.slice(a, b);
};

// The data (STRANDS ... SAMPLE), the lesson seeds and the route seed are plain JavaScript: run them as they are.
const data = between("var STRANDS = [", "var ALL_TOPICS");
const lessons = between("function seedLessons(){", "var S = fresh();");
const library = between("function seedLibrary(){", "function seedRoutes(){");
const routes = between("function seedRoutes(){", "\nfunction nextSessText");
const messages = between("sampleMsgs: [", "    ]\n  };");

const code = `
var Math_ = Math; var Date_ = Date;
function rid(p){ return (p || "x") + "id"; }
${data}
${lessons}
${library}
${routes}
var S = { lessons: seedLessons() };
seedLibrary();
var ROUTES = seedRoutes();
var MSGS = [${messages.replace(/^sampleMsgs: \[/, "")}];
RESULT = { STRANDS: STRANDS, QUESTIONS: QUESTIONS, GROUPS: GROUPS, SAMPLE: SAMPLE, LESSONS: S.lessons, ROUTES: ROUTES, MESSAGES: MSGS };
`;
const context = { RESULT: null, Date, Math };
vm.createContext(context);
vm.runInContext(code, context);

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "seed", "prototype-data.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(context.RESULT, null, 2));
const r = context.RESULT;
console.log(`Wrote ${out}: ${r.STRANDS.length} strands, ${r.GROUPS.length} groups, ${r.SAMPLE.length} students, ${Object.values(r.LESSONS).flat().length} lessons, ${r.ROUTES.length} route(s), ${r.MESSAGES.length} chats.`);
