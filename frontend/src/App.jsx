import { RouterProvider } from 'react-router-dom';

// routing
import router from 'routes';

// project imports
import NavigationScroll from 'layout/NavigationScroll';
import ApiRequestOverlay from 'ui-component/ApiRequestOverlay';

import ThemeCustomization from 'themes';
import { SocietyProvider } from 'contexts/SocietyContext';

// auth provider

// ==============================|| APP ||============================== //

export default function App() {
  return (
    <ThemeCustomization>
      <SocietyProvider>
        <NavigationScroll>
          <RouterProvider router={router} />
        </NavigationScroll>
        <ApiRequestOverlay />
      </SocietyProvider>
    </ThemeCustomization>
  );
}
