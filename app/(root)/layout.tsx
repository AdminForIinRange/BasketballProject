import React from "react";
import "../globals.css";
import Navbar from "@/components/Navbar/Navbar";

export const dynamic = "force-dynamic";
const Layout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Navbar />

      <div className="">{children}</div>
    </>
  );
};

export default Layout;
