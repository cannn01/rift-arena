import {Capacitor,SystemBars,SystemBarsStyle} from '@capacitor/core';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
if(Capacitor.isNativePlatform()){document.documentElement.dataset.native='true';void SystemBars.setStyle({style:SystemBarsStyle.Dark}).catch(()=>{});}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
