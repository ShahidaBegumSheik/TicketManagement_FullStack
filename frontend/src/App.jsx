import { useRoutes } from 'react-router-dom' 
import { appRoutes } from './router/routes'

export default function App() {
  return useRoutes(appRoutes);
}