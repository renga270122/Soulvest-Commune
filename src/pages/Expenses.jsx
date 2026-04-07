import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/AuthContext';
import {
  markPaymentAsPaid,
  seedResidentPaymentIfMissing,
  subscribeToResidentPayments,
} from '../services/communityData';

const formatAmount = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const formatDate = (value) => {
  if (!value) return 'No due date';
  if (typeof value === 'string') return new Date(value).toLocaleDateString();
  if (value?.toDate) return value.toDate().toLocaleDateString();
  return 'No due date';
};

export default function Expenses() {
  const { user } = useAuthContext();
  const [payments, setPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!user?.uid) return undefined;

    seedResidentPaymentIfMissing(user);
    const unsubscribe = subscribeToResidentPayments(user.uid, setPayments, user);
    return () => unsubscribe();
  }, [user]);

  const summary = useMemo(() => {
    const duePayments = payments.filter((payment) => payment.derivedStatus !== 'paid');
    const paidPayments = payments.filter((payment) => payment.derivedStatus === 'paid');
    const nextDue = duePayments
      .map((payment) => ({ ...payment, dueTime: new Date(payment.dueDate).getTime() }))
      .filter((payment) => !Number.isNaN(payment.dueTime))
      .sort((left, right) => left.dueTime - right.dueTime)[0];

    return {
      outstandingAmount: duePayments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
      totalPaid: paidPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
      dueCount: duePayments.length,
      overdueCount: duePayments.filter((payment) => payment.derivedStatus === 'overdue').length,
      nextDue,
    };
  }, [payments]);

  const duesInsight = useMemo(() => {
    if (summary.dueCount === 0) {
      return 'You are fully up to date. No maintenance dues are pending right now.';
    }

    const nextDueDate = summary.nextDue ? formatDate(summary.nextDue.dueDate) : 'the next cycle';
    return `You have ${summary.dueCount} open bill${summary.dueCount === 1 ? '' : 's'} worth ${formatAmount(summary.outstandingAmount)}. Next due date is ${nextDueDate}.`;
  }, [summary]);

  const handlePayNow = async () => {
    if (!selectedPayment) return;

    setSubmitting(true);
    setBanner({ type: '', message: '' });
    try {
      await markPaymentAsPaid(selectedPayment.id, {
        method: paymentMethod,
        paymentReference: `SV-${Date.now()}`,
        societyId: user?.societyId,
      });
      setBanner({ type: 'success', message: 'Payment recorded successfully.' });
      setSelectedPayment(null);
      setPaymentMethod('upi');
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to record payment.' });
    }
    setSubmitting(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Expenses & Payments
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Track maintenance dues, view the split, and record resident payments.
        </Typography>

        {banner.message && (
          <Alert severity={banner.type} sx={{ mb: 3 }}>
            {banner.message}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Outstanding</Typography>
            <Typography variant="h4">{formatAmount(summary.outstandingAmount)}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Paid So Far</Typography>
            <Typography variant="h4">{formatAmount(summary.totalPaid)}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Open Bills</Typography>
            <Typography variant="h4">{summary.dueCount}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Overdue</Typography>
            <Typography variant="h4">{summary.overdueCount}</Typography>
          </Paper>
        </Box>

        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>AI Concierge Insight</Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>{duesInsight}</Typography>
          {summary.nextDue && (
            <Chip label={`Reminder: ${summary.nextDue.title} due on ${formatDate(summary.nextDue.dueDate)}`} color="warning" variant="outlined" />
          )}
        </Paper>

        <Stack spacing={2}>
          {payments.length === 0 && (
            <Paper elevation={1} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6">No payment records yet</Typography>
              <Typography color="text.secondary">
                A starter maintenance bill will appear automatically for signed-in residents.
              </Typography>
            </Paper>
          )}

          {payments.map((payment) => (
            <Paper key={payment.id} elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="h6">{payment.title || 'Maintenance Bill'}</Typography>
                  <Typography color="text.secondary">
                    Due on {formatDate(payment.dueDate)}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>Flat: {payment.flat || user?.flat || 'Not assigned'}</Typography>
                </Box>

                <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
                  <Typography variant="h5">{formatAmount(payment.amount)}</Typography>
                  <Chip
                    label={payment.derivedStatus === 'paid' ? 'Paid' : payment.derivedStatus === 'overdue' ? 'Overdue' : 'Pending'}
                    color={payment.derivedStatus === 'paid' ? 'success' : payment.derivedStatus === 'overdue' ? 'error' : 'warning'}
                  />
                  {payment.derivedStatus !== 'paid' && (
                    <Button variant="contained" onClick={() => setSelectedPayment(payment)}>
                      Pay Now
                    </Button>
                  )}
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Expense Split
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {Object.entries(payment.breakdown || {}).map(([label, value]) => (
                  <Chip key={label} label={`${label}: ${value}%`} variant="outlined" />
                ))}
              </Stack>

              {payment.derivedStatus === 'paid' && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Paid via {payment.method || 'manual'} {payment.paymentReference ? `(${payment.paymentReference})` : ''}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      </Box>

      <Dialog open={Boolean(selectedPayment)} onClose={() => !submitting && setSelectedPayment(null)} fullWidth maxWidth="sm">
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Record payment for {selectedPayment?.title} of {formatAmount(selectedPayment?.amount)}.
          </Typography>
          <TextField
            select
            fullWidth
            label="Payment method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="card">Card</MenuItem>
            <MenuItem value="netbanking">Net Banking</MenuItem>
            <MenuItem value="cash">Cash</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPayment(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handlePayNow} disabled={submitting}>
            {submitting ? 'Recording...' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}
