import React from "react";
import "./Loader.css";

const Loader = ({ fullScreen = true }) => {
  const loaderContent = (
    <div className="loader">
      <div className="circle"></div>
      <div className="circle"></div>
      <div className="circle"></div>
      <div className="circle"></div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[9999]">
        {loaderContent}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">{loaderContent}</div>
  );
};

export default Loader;
