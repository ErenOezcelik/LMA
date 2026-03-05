import { index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.jsx"),
  route("emails/:id", "routes/emails.$id.jsx"),
  route("settings", "routes/settings.jsx"),
  route("api/sync", "routes/api.sync.jsx"),
  route("api/correct", "routes/api.correct.jsx"),
];
