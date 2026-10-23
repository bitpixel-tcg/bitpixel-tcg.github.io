import { createHashRouter, Navigate } from "react-router";
import SitePage from "./SitePage";

function HomeRoute() {
  return <SitePage page="home" />;
}

function CatalogueRoute() {
  return <SitePage page="catalogue" />;
}

export const router = createHashRouter([
  {
    path: "/",
    Component: HomeRoute,
  },
  {
    path: "/catalogue",
    Component: CatalogueRoute,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
