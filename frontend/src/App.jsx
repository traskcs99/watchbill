import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, CssBaseline,
  Box, ThemeProvider, createTheme, Tabs, Tab, Container
} from '@mui/material';
import Dashboard from './pages/Dashboard';
import Personnel from './pages/Personnel';
import Groups from './pages/Groups';
import Stations from './pages/Stations';
import Qualifications from './pages/Qualifications';
import ScheduleWorkspace from './pages/ScheduleWorkspace';

// Custom Command Theme
const theme = createTheme({
  palette: {
    primary: { main: '#1a237e' }, // Navy Blue
    background: { default: '#f4f6f8' } // Light Grey
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 800 }
  }
});

// Helper component for Navigation
function NavTabs() {
  const location = useLocation();
  const mainPaths = ['/', '/groups', '/personnel', '/stations', '/quals'];

  const currentTab = mainPaths.includes(location.pathname) ? location.pathname : false;
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
      <Tabs
        value={currentTab}
        centered
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab label="Schedules" value="/" component={Link} to="/" />
        <Tab label="Groups" value="/groups" component={Link} to="/groups" />
        <Tab label="Personnel" value="/personnel" component={Link} to="/personnel" />
        <Tab label="Stations" value="/stations" component={Link} to="/stations" />
        <Tab label="Quals" value="/quals" component={Link} to="/quals" />
      </Tabs>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <CssBaseline />
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100vw',
          bgcolor: 'background.default',
          overflowX: 'hidden'
        }}>

          <AppBar position="static" elevation={0}>
            <Toolbar>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                WATCHBILL COMMAND
              </Typography>
            </Toolbar>
          </AppBar>

          <NavTabs />

          {/* Main content area */}
          <Box component="main" sx={{ flexGrow: 1, width: '100%' }}>

            {/* 🟢 UPDATED: maxWidth={false} for full width, px={1} for small 8px gutter */}
            <Container
              maxWidth={false}
              sx={{
                height: '100%',
                px: { xs: 1, md: 1 } // Forces 8px padding on all screen sizes
              }}
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/personnel" element={<Personnel />} />
                <Route path="/stations" element={<Stations />} />
                <Route path="/quals" element={<Qualifications />} />
                <Route path="/schedules/:scheduleId" element={<ScheduleWorkspace />} />
              </Routes>
            </Container>

          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;