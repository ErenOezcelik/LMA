import { index, route } from "@react-router/dev/routes";

export default [
  index("routes/eingang.jsx"),
  route("tagesmappe", "routes/tagesmappe.jsx"),
  route("emails/:id", "routes/emails.$id.jsx"),
  route("settings", "routes/settings.jsx"),
  route("api/sync", "routes/api.sync.jsx"),
  route("api/correct", "routes/api.correct.jsx"),
];
