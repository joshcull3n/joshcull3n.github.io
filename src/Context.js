import React, { useState } from 'react';

export const Context = React.createContext();
export const ContextProvider = ({ children }) => {
  const lightModeStorage = window.localStorage.getItem('lightMode_cullen');
  const [lightMode, setLightMode] = useState(Boolean(lightModeStorage));

  return (
    <Context.Provider value={{ lightMode, setLightMode }}>
      { children }
    </Context.Provider>
  );
};