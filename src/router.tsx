
import { createBrowserRouter, Outlet } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import People from "./pages/People";
import PersonDetail from "./pages/PersonDetail";
import ProjectDetail from "./pages/ProjectDetail";
import Admin from "./pages/Admin";

const basename = import.meta.env.BASE_URL; // Vite sets this from `base` above
export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
  { index: true, element: <Overview /> },
  // { path: "overview", element: <Overview /> },
        { path: "people", element: <People /> },
        { path: "person/:id", element: <PersonDetail /> },
        { path: "project/:id", element: <ProjectDetail /> },
        { path: "admin", element: <Admin /> },
      ],
    },
  ],
  { basename }
);
