import React from "react";
import "../globals.css";

export const dynamic = "force-dynamic";
const Layout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <>
   
   

      <div className="">{children}</div>
    </>
  );
};

export default Layout;
