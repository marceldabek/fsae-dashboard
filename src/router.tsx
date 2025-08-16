import { createBrowserRouter, Navigate } from "react-router-dom";
import React, { Suspense } from "react";
import Layout from "./components/Layout";
import Loader from "./components/Loader";
const Overview = React.lazy(() => import("./pages/Overview"));
const Members = React.lazy(() => import("./pages/Members"));
const PersonDetail = React.lazy(() => import("./pages/PersonDetail"));
const ProjectDetail = React.lazy(() => import("./pages/ProjectDetail"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Stats = React.lazy(() => import("./pages/Stats"));
const Timeline = React.lazy(() => import("./pages/Timeline"));
const Ranked = React.lazy(() => import("./pages/Ranked"));

const basename = import.meta.env.BASE_URL;

export const router = createBrowserRouter([
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
      { path: "people", element: <Navigate to="/members" replace /> },
      {
        path: "members",
        element: (
          <Suspense fallback={<Loader />}>
            <Members />
          </Suspense>
        ),
      },
      {
        path: "stats",
        element: (
          <Suspense fallback={<Loader />}>
            <Stats />
          </Suspense>
        ),
      },
      {
        path: "timeline",
        element: (
          <Suspense fallback={<Loader />}>
            <Timeline />
          </Suspense>
        ),
      },
      {
        path: "ranked",
        element: (
          <Suspense fallback={<Loader />}>
            <Ranked />
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
], { basename });

export default router;
