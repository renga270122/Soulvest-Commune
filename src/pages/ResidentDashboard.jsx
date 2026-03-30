
import ChatbotWidget from '../components/ChatbotWidget';

const ResidentDashboard = () => {
  return (
    <Box p={3} bgcolor="#f5f5f5" minHeight="100vh">
      <Typography variant="h4" mb={3} color="primary" fontWeight={700} align="center">
        Soulvest Commune
      </Typography>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" mb={2}>Resident Dashboard</Typography>
      </Paper>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6">Pending Visitor Approvals</Typography>
        {/* Pending approvals will be listed here */}
      </Paper>
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">Notifications</Typography>
        {/* Notifications will be listed here */}
      </Paper>
      {/* Chatbot widget will be added here later */}
      <ChatbotWidget />
    </Box>
  );
};

export default ResidentDashboard;
