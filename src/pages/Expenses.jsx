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
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/auth-context';
import {
  markPaymentAsPaid,
  seedResidentPaymentIfMissing,
  subscribeToResidentPayments,
} from '../services/communityData';
import QRCode from 'react-qr-code';
import {
  createRazorpayOrder,
  openRazorpayCheckout,
  verifyRazorpayPayment,
} from '../services/razorpay';
import { useTranslation } from 'react-i18next';

const formatAmount = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const upiId = import.meta.env.VITE_UPI_ID || 'payments@soulvest';
const upiPayee = import.meta.env.VITE_UPI_PAYEE_NAME || 'Soulvest Commune';
const formatDate = (value) => {
  if (!value) return 'No due date';
  if (typeof value === 'string') return new Date(value).toLocaleDateString();
  if (value?.toDate) return value.toDate().toLocaleDateString();
  return 'No due date';
};

export default function Expenses() {
  const { user } = useAuthContext();
  const { t } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [activeReceipt, setActiveReceipt] = useState(null);

  const buildUpiUri = (payment) => {
    const params = new URLSearchParams({
      pa: upiId,
      pn: upiPayee,
      tn: payment.title || 'Soulvest resident payment',
      am: String(payment.amount || 0),
      cu: 'INR',
      tr: payment.paymentReference || `SV-${payment.id}`,
    });
    return `upi://pay?${params.toString()}`;
  };

  const handleOpenUpi = (payment) => {
    window.location.href = buildUpiUri(payment);
  };

  const buildReceiptText = (payment) => {
    const receiptNumber = payment.receiptNumber || `RCP-PENDING-${payment.id}`;
    return [
      'Soulvest Commune Payment Receipt',
      `Receipt: ${receiptNumber}`,
      `Resident: ${user?.name || 'Resident'}`,
      `Flat: ${payment.flat || user?.flat || 'Not assigned'}`,
      `Charge: ${payment.title || 'Resident charge'}`,
      `Amount: ${formatAmount(payment.amount)}`,
      `Method: ${(payment.method || 'manual').toUpperCase()}`,
      `Reference: ${payment.paymentReference || 'Not available'}`,
      `Paid At: ${formatDate(payment.paidAt || payment.receiptIssuedAt)}`,
    ].join('\n');
  };

  const handleDownloadReceipt = (payment) => {
    const blob = new Blob([buildReceiptText(payment)], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${payment.receiptNumber || `receipt-${payment.id}`}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

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
      return t('expenses.insight.clear');
    }

    const nextDueDate = summary.nextDue ? formatDate(summary.nextDue.dueDate) : 'the next cycle';
    return t('expenses.insight.pending', {
      count: summary.dueCount,
      amount: formatAmount(summary.outstandingAmount),
      nextDueDate,
    });
  }, [summary, t]);

  const handlePayNow = async () => {
    if (!selectedPayment) return;

    const currentPayment = selectedPayment;
    setSubmitting(true);
    setBanner({ type: '', message: '' });
    try {
      if (paymentMethod === 'razorpay') {
        const order = await createRazorpayOrder({
          amount: currentPayment.amount,
          currency: 'INR',
          receipt: `sv_${currentPayment.id}_${Date.now()}`,
          paymentId: currentPayment.id,
          userId: user?.uid,
          societyId: user?.societyId,
          title: currentPayment.title,
          notes: {
            residentName: user?.name || 'Resident',
            flat: currentPayment.flat || user?.flat || '',
          },
        });

        const razorpayResponse = await openRazorpayCheckout({
          order,
          payment: currentPayment,
          user,
        });

        const verification = await verifyRazorpayPayment({
          ...razorpayResponse,
          paymentId: currentPayment.id,
          userId: user?.uid,
          societyId: user?.societyId,
        });

        const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        await markPaymentAsPaid(currentPayment.id, {
          method: 'razorpay',
          paymentReference: verification.paymentId,
          providerOrderId: verification.orderId,
          providerPaymentId: verification.paymentId,
          providerSignature: verification.signature,
          receiptNumber,
          amount: currentPayment.amount,
          societyId: user?.societyId,
        });

        setBanner({ type: 'success', message: t('expenses.messages.razorpaySuccess') });
        setActiveReceipt({
          ...currentPayment,
          method: 'razorpay',
          paymentReference: verification.paymentId,
          providerOrderId: verification.orderId,
          receiptNumber,
          receiptIssuedAt: new Date().toISOString(),
        });
        setSelectedPayment(null);
        setPaymentMethod('razorpay');
        setSubmitting(false);
        return;
      }

      const paymentReference = `SV-${Date.now()}`;
      const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      await markPaymentAsPaid(currentPayment.id, {
        method: paymentMethod,
        paymentReference,
        receiptNumber,
        amount: currentPayment.amount,
        societyId: user?.societyId,
      });
      setBanner({ type: 'success', message: t('expenses.messages.recorded') });
      setActiveReceipt({
        ...currentPayment,
        method: paymentMethod,
        paymentReference,
        receiptNumber,
        receiptIssuedAt: new Date().toISOString(),
      });
      setSelectedPayment(null);
      setPaymentMethod('razorpay');
    } catch (error) {
      setBanner({ type: 'error', message: error.message || t('expenses.messages.recordFailed') });
    }
    setSubmitting(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {t('expenses.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t('expenses.subtitle')}
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
            <Typography color="text.secondary">{t('expenses.stats.outstanding')}</Typography>
            <Typography variant="h4">{formatAmount(summary.outstandingAmount)}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('expenses.stats.paid')}</Typography>
            <Typography variant="h4">{formatAmount(summary.totalPaid)}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('expenses.stats.openBills')}</Typography>
            <Typography variant="h4">{summary.dueCount}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">{t('expenses.stats.overdue')}</Typography>
            <Typography variant="h4">{summary.overdueCount}</Typography>
          </Paper>
        </Box>

        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('expenses.insightTitle')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>{duesInsight}</Typography>
          {summary.nextDue && (
            <Chip label={t('expenses.reminder', { title: summary.nextDue.title, dueDate: formatDate(summary.nextDue.dueDate) })} color="warning" variant="outlined" />
          )}
        </Paper>

        <Stack spacing={2}>
          {payments.length === 0 && (
            <Paper elevation={1} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6">{t('expenses.emptyTitle')}</Typography>
              <Typography color="text.secondary">
                {t('expenses.emptySubtitle')}
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
                  <Typography variant="h6">{payment.title || t('expenses.maintenanceBill')}</Typography>
                  <Typography color="text.secondary">
                    {t('expenses.dueOn', { dueDate: formatDate(payment.dueDate) })}
                  </Typography>
                  <Typography sx={{ mt: 1 }}>{t('expenses.flatLabel', { flat: payment.flat || user?.flat || t('expenses.notAssigned') })}</Typography>
                </Box>

                <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
                  <Typography variant="h5">{formatAmount(payment.amount)}</Typography>
                  <Chip
                    label={payment.derivedStatus === 'paid' ? t('expenses.status.paid') : payment.derivedStatus === 'overdue' ? t('expenses.status.overdue') : t('expenses.status.pending')}
                    color={payment.derivedStatus === 'paid' ? 'success' : payment.derivedStatus === 'overdue' ? 'error' : 'warning'}
                  />
                  {payment.derivedStatus !== 'paid' && (
                    <Button variant="contained" onClick={() => setSelectedPayment(payment)}>
                      {t('expenses.payNow')}
                    </Button>
                  )}
                  {payment.derivedStatus === 'paid' && (
                    <Button variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => setActiveReceipt(payment)}>
                      {t('expenses.viewReceipt')}
                    </Button>
                  )}
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('expenses.expenseSplit')}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {Object.entries(payment.breakdown || {}).map(([label, value]) => (
                  <Chip key={label} label={`${label}: ${value}%`} variant="outlined" />
                ))}
              </Stack>

              {payment.derivedStatus === 'paid' && (
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  {t('expenses.paidVia', { method: payment.method || 'manual', reference: payment.paymentReference || '' })}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      </Box>

      <Dialog open={Boolean(selectedPayment)} onClose={() => !submitting && setSelectedPayment(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('expenses.confirmPayment')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {t('expenses.confirmPaymentCopy', { title: selectedPayment?.title, amount: formatAmount(selectedPayment?.amount) })}
          </Typography>
          <TextField
            select
            fullWidth
            label={t('expenses.paymentMethod')}
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <MenuItem value="razorpay">{t('expenses.methods.razorpay')}</MenuItem>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="cash">{t('expenses.methods.cash')}</MenuItem>
          </TextField>
          {paymentMethod === 'razorpay' && selectedPayment && (
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Typography color="text.secondary">
                {t('expenses.razorpayCopy')}
              </Typography>
              <Alert severity="info">
                {t('expenses.razorpayInfo')}
              </Alert>
            </Stack>
          )}
          {paymentMethod === 'upi' && selectedPayment && (
            <Stack spacing={1.5} sx={{ mt: 2, alignItems: 'center' }}>
              <Typography color="text.secondary">
                {t('expenses.upiCopy')}
              </Typography>
              <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 2 }}>
                <QRCode value={buildUpiUri(selectedPayment)} size={168} />
              </Box>
              <Button variant="outlined" onClick={() => handleOpenUpi(selectedPayment)}>
                {t('expenses.openUpiApp')}
              </Button>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPayment(null)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handlePayNow} disabled={submitting}>
            {submitting ? t('expenses.recording') : t('expenses.confirmPaymentAction')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeReceipt)} onClose={() => setActiveReceipt(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t('expenses.receiptTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="subtitle2">{t('expenses.receipt.number')}</Typography>
            <Typography>{activeReceipt?.receiptNumber || t('expenses.receipt.pendingReceipt')}</Typography>
            <Typography variant="subtitle2">{t('expenses.receipt.charge')}</Typography>
            <Typography>{activeReceipt?.title}</Typography>
            <Typography variant="subtitle2">{t('expenses.receipt.amount')}</Typography>
            <Typography>{formatAmount(activeReceipt?.amount)}</Typography>
            <Typography variant="subtitle2">{t('expenses.receipt.method')}</Typography>
            <Typography>{(activeReceipt?.method || 'manual').toUpperCase()}</Typography>
            <Typography variant="subtitle2">{t('expenses.receipt.reference')}</Typography>
            <Typography>{activeReceipt?.paymentReference || t('expenses.receipt.pendingSync')}</Typography>
            {activeReceipt?.providerOrderId && (
              <>
                <Typography variant="subtitle2">{t('expenses.receipt.gatewayOrder')}</Typography>
                <Typography>{activeReceipt.providerOrderId}</Typography>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => activeReceipt && handleDownloadReceipt(activeReceipt)}>{t('expenses.downloadReceipt')}</Button>
          <Button onClick={() => setActiveReceipt(null)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}
