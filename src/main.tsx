
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import './index.css'

// Register SW using Vite base URL
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const url = (import.meta.env.BASE_URL || "/") + "sw.js";
    navigator.serviceWorker.register(url).catch(()=>{});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
