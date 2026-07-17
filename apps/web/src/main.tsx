import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './workspace.css';
import { App } from './App';

const theme=createTheme({primaryColor:'cyan',defaultRadius:'sm',fontFamily:'Inter, "Microsoft YaHei", sans-serif',components:{Button:{defaultProps:{radius:'sm'}},ActionIcon:{defaultProps:{radius:'sm'}}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><MantineProvider theme={theme} defaultColorScheme="dark"><Notifications position="top-right"/><App/></MantineProvider></React.StrictMode>);
