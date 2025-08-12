

import { createBrowserRouter, Outlet } from "react-router-dom";
import React, { Suspense } from "react";
import Layout from "./components/Layout";
import Loader from "./components/Loader";
const Overview = React.lazy(() => import("./pages/Overview"));
const People = React.lazy(() => import("./pages/People"));
const PersonDetail = React.lazy(() => import("./pages/PersonDetail"));
const ProjectDetail = React.lazy(() => import("./pages/ProjectDetail"));
const Admin = React.lazy(() => import("./pages/Admin"));

const basename = import.meta.env.BASE_URL; // Vite sets this from `base` above
export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<Loader />}>
              <Overview />
            </Suspense>
          ),
        },
        {
          path: "people",
          element: (
            <Suspense fallback={<Loader />}>
              <People />
            </Suspense>
          ),
        },
        {
          path: "person/:id",
          element: (
            <Suspense fallback={<Loader />}>
              <PersonDetail />
            </Suspense>
          ),
        },
        {
          path: "project/:id",
          element: (
            <Suspense fallback={<Loader />}>
              <ProjectDetail />
            </Suspense>
          ),
        },
        {
          path: "admin",
          element: (
            <Suspense fallback={<Loader />}>
              <Admin />
            </Suspense>
          ),
        },
      ],
    },
  ],
  { basename }
);
