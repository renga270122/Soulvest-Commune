import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  ButtonBase,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import CampaignIcon from '@mui/icons-material/Campaign';
import BugReportIcon from '@mui/icons-material/BugReport';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GroupsIcon from '@mui/icons-material/Groups';
import BoltIcon from '@mui/icons-material/Bolt';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import topIllustration from '../assets/top-illustration.png';
import bottomIllustration from '../assets/bottom-illustration.png';
import { useAuthContext } from '../components/auth-context';
import ChatbotWidget from '../components/ChatbotWidget';
import {
  createResidentStaff,
  createVisitorPass,
  deleteResidentStaff,
  getUserProfileByUid,
  markDeliveryCollected,
  markNotificationAsRead,
  normalizeFlat,
  routeDelivery,
  seedResidentPaymentIfMissing,
  subscribeToNotifications,
  subscribeToResidentPayments,
  subscribeToResidentStaff,
  subscribeToResidentStaffAttendance,
  subscribeToVisitors,
  updateResidentStaff,
  updateVisitorStatus,
} from '../services/communityData';

const statusColorMap = {
  approved: 'success',
  awaiting_instruction: 'warning',
  checked_in: 'success',
  checked_out: 'default',
  denied: 'error',
  doorstep: 'success',
  expired: 'error',
  pending: 'warning',
  pending_pickup: 'info',
  picked_up: 'success',
  security_hold_requested: 'info',
  preapproved: 'info',
  security_received: 'info',
};

const vendorStyleMap = {
  amazon: { label: 'Amazon', bg: 'rgba(17, 24, 39, 0.08)', color: '#111827' },
  swiggy: { label: 'Swiggy', bg: 'rgba(255, 112, 67, 0.14)', color: '#f97316' },
  zomato: { label: 'Zomato', bg: 'rgba(239, 68, 68, 0.14)', color: '#dc2626' },
  dunzo: { label: 'Dunzo', bg: 'rgba(37, 99, 235, 0.14)', color: '#2563eb' },
  blinkit: { label: 'Blinkit', bg: 'rgba(234, 179, 8, 0.18)', color: '#a16207' },
  zepto: { label: 'Zepto', bg: 'rgba(99, 102, 241, 0.16)', color: '#4338ca' },
};

const staffRolePattern = /(maid|driver|cook|nanny|caretaker|cleaner|staff|helper)/i;

const formatTextValue = (value, fallback = 'Not available') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    if (typeof value.label === 'string' && value.label.trim()) {
      return value.label.trim();
    }
    if (typeof value.text === 'string' && value.text.trim()) {
      return value.text.trim();
    }
  }

  return fallback;
};

const formatDateTimeValue = (value, fallback = 'Not scheduled') => {
  if (!value) return fallback;

  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
  }

  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toLocaleString();
  }

  return fallback;
};

const formatDateValue = (value, fallback = 'No due date') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatTimeValue = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const formatAccessWindow = (start, end) => {
  if (!start && !end) return 'All day';
  if (!start || !end) return 'Flexible timing';
  const baseDate = '2026-01-01';
  const startLabel = formatTimeValue(`${baseDate}T${start}:00`, start);
  const endLabel = formatTimeValue(`${baseDate}T${end}:00`, end);
  return `${startLabel} - ${endLabel}`;
};

const getVendorMeta = (visitor) => {
  const source = `${visitor?.vendorName || ''} ${visitor?.name || ''}`.toLowerCase();
  const key = Object.keys(vendorStyleMap).find((entry) => source.includes(entry));
  return vendorStyleMap[key] || {
    label: formatTextValue(visitor?.vendorName || visitor?.name, 'Delivery'),
    bg: 'rgba(36, 86, 166, 0.12)',
    color: '#2456A6',
  };
};

const getDeliveryStatusLabel = (visitor) => {
  if (visitor.deliveryStatus === 'picked_up') return 'Collected';
  if (visitor.deliveryStatus === 'security_received') return 'Delivered to Security';
  if (visitor.deliveryStatus === 'security_hold_requested') return 'Hold at Security';
  if (visitor.deliveryStatus === 'doorstep') return 'Doorstep';
  if (visitor.deliveryStatus === 'pending_pickup') return 'Awaiting pickup';
  if (visitor.deliveryStatus === 'awaiting_instruction') return 'Waiting';
  return formatTextValue(visitor.status, 'Pending');
};

const canConfirmDeliveryReceipt = (visitor) => (
  ['doorstep', 'pending_pickup', 'security_hold_requested', 'security_received'].includes(visitor.deliveryStatus)
  || (visitor.status === 'approved' && !visitor.deliveryStatus)
);

const matchesStaffMember = (visitor, staffMember) => {
  const visitorName = formatTextValue(visitor?.name, '').toLowerCase();
  const visitorPhone = formatTextValue(visitor?.phone, '');
  const visitorPurpose = formatTextValue(visitor?.purpose, '').toLowerCase();
  const staffName = formatTextValue(staffMember?.name, '').toLowerCase();
  const staffPhone = formatTextValue(staffMember?.phone, '');
  const staffRole = formatTextValue(staffMember?.roleLabel, '').toLowerCase();

  return Boolean(
    (staffName && visitorName && staffName === visitorName)
    || (staffPhone && visitorPhone && staffPhone === visitorPhone)
    || (staffRole && visitorPurpose.includes(staffRole)),
  );
};

const isDeliveryVisitor = (visitor) => /delivery|courier|parcel|amazon|swiggy|zomato|dunzo|blinkit|zepto/i.test(`${visitor?.purpose || ''} ${visitor?.name || ''} ${visitor?.vendorName || ''}`);

const isWithinStaffWindow = (staffMember) => {
  if (!staffMember?.autoApproved) return false;
  if (!staffMember.accessStartTime || !staffMember.accessEndTime) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startHours, startMinutes] = staffMember.accessStartTime.split(':').map(Number);
  const [endHours, endMinutes] = staffMember.accessEndTime.split(':').map(Number);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  if (Number.isNaN(startTotal) || Number.isNaN(endTotal)) return true;
  return currentMinutes >= startTotal && currentMinutes <= endTotal;
};

const dashboardShellSx = {
  minHeight: '100vh',
  px: { xs: 2, md: 3 },
  py: { xs: 2.5, md: 3.5 },
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, #fff4df 0%, #f6dfb6 18%, #f7edd7 54%, #efd29e 100%)',
};

const softCardSx = {
  p: 2.5,
  borderRadius: 5,
  background: 'linear-gradient(180deg, rgba(255,249,239,0.96) 0%, rgba(255,246,232,0.92) 100%)',
  border: '1px solid rgba(194, 137, 64, 0.28)',
  boxShadow: '0 18px 38px rgba(120, 74, 24, 0.16)',
};

const pillButtonSx = {
  justifyContent: 'center',
  px: 1.8,
  py: 1.05,
  borderRadius: 2,
  color: '#5b2b14',
  bgcolor: 'rgba(255, 247, 235, 0.84)',
  borderColor: 'rgba(166, 115, 45, 0.22)',
  boxShadow: 'none',
  fontWeight: 800,
  fontFamily: 'Georgia, "Times New Roman", serif',
  '&:hover': {
    borderColor: 'rgba(166, 115, 45, 0.38)',
    bgcolor: 'rgba(255, 250, 243, 0.96)',
  },
};

const compactCardSx = {
  p: 2,
  borderRadius: 4,
  background: 'rgba(255, 251, 245, 0.94)',
  border: '1px solid rgba(223, 199, 165, 0.42)',
  boxShadow: '0 12px 28px rgba(188, 155, 104, 0.14)',
};

const defaultStaffForm = {
  name: '',
  roleLabel: 'Maid',
  phone: '',
  autoApproved: true,
  accessStartTime: '07:00',
  accessEndTime: '12:00',
  notes: '',
};

const templeTitleSx = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: '#6c2f11',
  textShadow: '0 1px 0 rgba(255,255,255,0.7)',
};

const sectionHeadingSx = {
  ...templeTitleSx,
  fontSize: { xs: 26, md: 34 },
  lineHeight: 1.02,
};

const ornamentOrbSx = {
  width: 94,
  height: 94,
  borderRadius: '30px',
  background: 'radial-gradient(circle at 32% 28%, rgba(255,239,189,0.98) 0%, rgba(225,157,52,0.95) 48%, rgba(122,77,24,0.92) 100%)',
  boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.5), 0 16px 26px rgba(129, 78, 21, 0.24)',
  display: 'grid',
  placeItems: 'center',
  color: '#fff9ef',
  flexShrink: 0,
};

const desktopPanelSx = {
  ...softCardSx,
  p: 2.5,
  borderRadius: '34px',
  position: 'relative',
  overflow: 'hidden',
  backdropFilter: 'blur(6px)',
};

const mobileHeroCardSx = {
  ...softCardSx,
  position: 'relative',
  overflow: 'hidden',
  p: 2,
  borderRadius: '28px',
  background: 'linear-gradient(180deg, rgba(255,248,233,0.98) 0%, rgba(248,226,181,0.92) 100%)',
  border: '1px solid rgba(183, 123, 48, 0.26)',
  boxShadow: '0 18px 34px rgba(120, 74, 24, 0.16)',
};

const mobileSectionCardSx = {
  ...compactCardSx,
  borderRadius: '28px',
  background: 'linear-gradient(180deg, rgba(255,250,240,0.96) 0%, rgba(255,244,220,0.92) 100%)',
  border: '1px solid rgba(194, 137, 64, 0.22)',
  boxShadow: '0 16px 30px rgba(129, 78, 21, 0.14)',
};

const mobileSectionTitleSx = {
  ...templeTitleSx,
  fontSize: 24,
  fontWeight: 700,
};

const mobileActionButtonSx = {
  minWidth: 0,
  px: 1,
  py: 1,
  borderRadius: 0,
  color: '#5b2b14',
  fontWeight: 800,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 11.5,
  borderColor: 'rgba(166, 115, 45, 0.16)',
};

export default function ResidentDashboard() {
  const [visitors, setVisitors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payments, setPayments] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffAttendance, setStaffAttendance] = useState([]);
  const [residentProfile, setResidentProfile] = useState(null);
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [updatingId, setUpdatingId] = useState('');
  const [activeMobileTab, setActiveMobileTab] = useState('visitors');
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [creatingPass, setCreatingPass] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState('');
  const [createdPass, setCreatedPass] = useState(null);
  const [passForm, setPassForm] = useState({
    visitorName: '',
    purpose: 'Guest visit',
    phone: '',
    expectedAt: '',
    notes: '',
  });
  const [staffForm, setStaffForm] = useState(defaultStaffForm);
  const [notedStaffAlertIds, setNotedStaffAlertIds] = useState([]);
  const [attendanceHistoryOpen, setAttendanceHistoryOpen] = useState(false);
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const knownNotificationIds = useRef(new Set());
  const notificationsInitialized = useRef(false);
  const topSectionRef = useRef(null);
  const visitorsSectionRef = useRef(null);
  const staffSectionRef = useRef(null);
  const duesSectionRef = useRef(null);
  const swipeStartRef = useRef({});
  const autoApprovedStaffVisitorIds = useRef(new Set());

  useEffect(() => {
    const unsubscribe = subscribeToVisitors(setVisitors, user);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(user?.uid, setNotifications);
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    void seedResidentPaymentIfMissing(user);
    const unsubscribe = subscribeToResidentPayments(user.uid, setPayments, user);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribeStaff = subscribeToResidentStaff(user.uid, setStaffMembers, user);
    const unsubscribeAttendance = subscribeToResidentStaffAttendance(user.uid, setStaffAttendance, user);
    return () => {
      unsubscribeStaff();
      unsubscribeAttendance();
    };
  }, [user]);

  useEffect(() => {
    if (!notifications.length) return;

    if (!notificationsInitialized.current) {
      notifications.forEach((notification) => knownNotificationIds.current.add(notification.id));
      notificationsInitialized.current = true;
      return;
    }

    notifications.forEach((notification) => {
      if (knownNotificationIds.current.has(notification.id)) return;
      knownNotificationIds.current.add(notification.id);

      if (
        ['visitor-entered', 'visitor-exited', 'visitor-awaiting-approval'].includes(notification.type)
        && typeof Notification !== 'undefined'
        && Notification.permission === 'granted'
      ) {
        new Notification(notification.title, { body: notification.message });
      }
    });
  }, [notifications]);

  useEffect(() => {
    if (!user?.uid) {
      setResidentProfile(null);
      return undefined;
    }

    let active = true;

    void getUserProfileByUid(user.uid)
      .then((profile) => {
        if (!active) return;
        setResidentProfile(profile || null);
      })
      .catch(() => {
        if (!active) return;
        setResidentProfile(null);
      });

    return () => {
      active = false;
    };
  }, [user?.uid]);

  const residentUser = useMemo(() => {
    if (!user && !residentProfile) return null;

    return {
      ...(user || {}),
      ...(residentProfile || {}),
      flat: normalizeFlat(residentProfile?.flat || user?.flat),
    };
  }, [residentProfile, user]);

  const myFlat = normalizeFlat(residentUser?.flat);
  const myVisitors = useMemo(
    () => visitors.filter((visitor) => normalizeFlat(visitor.flat) === myFlat),
    [myFlat, visitors],
  );

  const pendingVisitors = useMemo(
    () => myVisitors.filter((visitor) => visitor.status === 'pending'),
    [myVisitors],
  );
  const guestVisitors = useMemo(
    () => myVisitors.filter((visitor) => !isDeliveryVisitor(visitor) && !staffMembers.some((staffMember) => matchesStaffMember(visitor, staffMember)) && !staffRolePattern.test(`${visitor.purpose || ''} ${visitor.name || ''}`)),
    [myVisitors, staffMembers],
  );
  const staffVisitors = useMemo(
    () => myVisitors.filter((visitor) => !isDeliveryVisitor(visitor) && (staffMembers.some((staffMember) => matchesStaffMember(visitor, staffMember)) || staffRolePattern.test(`${visitor.purpose || ''} ${visitor.name || ''}`))),
    [myVisitors, staffMembers],
  );
  const pendingGuestVisitors = useMemo(
    () => guestVisitors.filter((visitor) => visitor.status === 'pending'),
    [guestVisitors],
  );
  const pendingStaffVisitors = useMemo(
    () => staffVisitors.filter((visitor) => visitor.status === 'pending'),
    [staffVisitors],
  );
  const preApprovedVisitors = useMemo(
    () => myVisitors.filter((visitor) => visitor.status === 'preapproved'),
    [myVisitors],
  );
  const duePayments = useMemo(
    () => payments.filter((payment) => payment.derivedStatus !== 'paid'),
    [payments],
  );
  const deliveryVisitors = useMemo(
    () => myVisitors.filter((visitor) => /delivery/i.test(`${visitor.purpose || ''} ${visitor.name || ''}`)),
    [myVisitors],
  );
  const pendingDeliveryVisitors = useMemo(
    () => deliveryVisitors.filter((visitor) => visitor.status === 'pending' || visitor.deliveryStatus === 'awaiting_instruction'),
    [deliveryVisitors],
  );
  const deliveryHistory = useMemo(
    () => deliveryVisitors.filter((visitor) => visitor.deliveryStatus || visitor.status !== 'pending'),
    [deliveryVisitors],
  );

  const dueSummary = useMemo(() => {
    const outstandingAmount = duePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const nextDue = [...duePayments]
      .filter((payment) => payment.dueDate)
      .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())[0] || null;

    return {
      outstandingAmount,
      nextDue,
      openCount: duePayments.length,
    };
  }, [duePayments]);

  const leadNotification = notifications[0] || null;
  const spotlightVisitor = preApprovedVisitors[0] || pendingVisitors[0] || myVisitors[0] || null;
  const residentName = formatTextValue(residentUser?.name, 'Resident');
  const residentFirstName = residentName.split(' ')[0];
  const residentInitials = residentName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'R';
  const residentAvatarSrc = residentUser?.photoDataUrl || '';
  const residentProfileFacts = useMemo(() => {
    const items = [];

    if (residentUser?.vehicleNumber) {
      items.push(`Vehicle ${residentUser.vehicleNumber}`);
    }

    if (residentUser?.emergencyContactName) {
      items.push(`Emergency: ${residentUser.emergencyContactName}${residentUser?.emergencyContactPhone ? ` (${residentUser.emergencyContactPhone})` : ''}`);
    }

    if (residentUser?.householdSize) {
      items.push(`${residentUser.householdSize} resident${Number(residentUser.householdSize) === 1 ? '' : 's'}`);
    }

    if (residentUser?.language) {
      items.push(`Language ${String(residentUser.language).toUpperCase()}`);
    }

    return items;
  }, [residentUser?.emergencyContactName, residentUser?.emergencyContactPhone, residentUser?.householdSize, residentUser?.language, residentUser?.vehicleNumber]);
  const activeStaffAlert = useMemo(
    () => staffAttendance.find((entry) => entry.alertType && !notedStaffAlertIds.includes(entry.id)) || null,
    [notedStaffAlertIds, staffAttendance],
  );
  const approvalOverview = useMemo(
    () => ({
      guests: pendingGuestVisitors.length,
      staff: pendingStaffVisitors.length,
      delivery: pendingDeliveryVisitors.length,
    }),
    [pendingDeliveryVisitors.length, pendingGuestVisitors.length, pendingStaffVisitors.length],
  );

  const handlePassFormChange = (event) => {
    setPassForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  };

  const handleStaffFormChange = (event) => {
    setStaffForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.name === 'autoApproved' ? event.target.value === 'true' : event.target.value,
    }));
  };

  const openPassDialog = (purpose = 'Guest visit') => {
    setPassForm((currentForm) => ({
      ...currentForm,
      purpose,
    }));
    setPassDialogOpen(true);
  };

  const openStaffDialog = (staffMember = null) => {
    if (staffMember) {
      setEditingStaffId(staffMember.id);
      setStaffForm({
        name: staffMember.name || '',
        roleLabel: staffMember.roleLabel || 'Maid',
        phone: staffMember.phone || '',
        autoApproved: staffMember.autoApproved !== false,
        accessStartTime: staffMember.accessStartTime || '07:00',
        accessEndTime: staffMember.accessEndTime || '12:00',
        notes: staffMember.notes || '',
      });
    } else {
      setEditingStaffId('');
      setStaffForm(defaultStaffForm);
    }

    setStaffDialogOpen(true);
  };

  const handleCreatePass = async () => {
    if (!user?.uid || !myFlat) {
      setBanner({ type: 'error', message: 'Your resident profile needs a flat number before creating visitor passes.' });
      return;
    }
    if (!passForm.visitorName || !passForm.purpose || !passForm.expectedAt) {
      setBanner({ type: 'error', message: 'Visitor name, purpose, and expected time are required.' });
      return;
    }

    setCreatingPass(true);
    setBanner({ type: '', message: '' });
    try {
      const pass = await createVisitorPass({
        ...passForm,
        residentId: user.uid,
        residentName: user.name || 'Resident',
        flat: myFlat,
        societyId: user.societyId,
      });
      setCreatedPass({
        ...pass,
        visitorName: passForm.visitorName,
        expectedAt: passForm.expectedAt,
      });
      setPassDialogOpen(false);
      setPassForm({ visitorName: '', purpose: 'Guest visit', phone: '', expectedAt: '', notes: '' });
      setBanner({ type: 'success', message: `Visitor pass created for ${passForm.visitorName}. Share the OTP or QR with your guest.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to create the visitor pass.' });
    }
    setCreatingPass(false);
  };

  const handleSaveStaff = async () => {
    if (!user?.uid || !staffForm.name.trim()) {
      setBanner({ type: 'error', message: 'Staff name is required.' });
      return;
    }

    setCreatingStaff(true);
    setBanner({ type: '', message: '' });
    try {
      if (editingStaffId) {
        await updateResidentStaff(editingStaffId, {
          ...staffForm,
          roleLabel: staffForm.roleLabel,
          autoApproved: staffForm.autoApproved,
        });
      } else {
        await createResidentStaff({
          ...staffForm,
          residentId: user.uid,
          residentName: residentName,
          societyId: user.societyId,
        });
      }

      setStaffDialogOpen(false);
      setEditingStaffId('');
      setStaffForm(defaultStaffForm);
      setBanner({
        type: 'success',
        message: editingStaffId ? `${staffForm.name.trim()} updated successfully.` : `${staffForm.name.trim()} added to verified staff.`,
      });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to save this staff member.' });
    }
    setCreatingStaff(false);
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    try {
      await deleteResidentStaff(staffId);
      setBanner({ type: 'success', message: `${staffName} archived from verified staff. Attendance history is preserved.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to remove this staff member.' });
    }
  };

  const handleVisitorDecision = async (visitorId, status) => {
    setUpdatingId(visitorId);
    setBanner({ type: '', message: '' });
    try {
      await updateVisitorStatus(visitorId, status, {
        uid: user?.uid || '',
        name: residentUser?.name || 'Resident',
        societyId: user?.societyId,
      });
      setBanner({ type: 'success', message: `Visitor ${status}.` });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to update visitor status.' });
    }
    setUpdatingId('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const requestBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') {
      setBanner({ type: 'warning', message: 'Browser notifications are not supported on this device.' });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setBanner({ type: 'success', message: 'Browser alerts enabled for visitor entry updates.' });
      return;
    }

    setBanner({ type: 'warning', message: 'Notification permission was not granted.' });
  };

  const handleMarkNotificationRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to mark the notification as read.' });
    }
  };

  const handleCopyPassText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      setBanner({ type: 'success', message: successMessage });
    } catch {
      setBanner({ type: 'warning', message: 'Clipboard access is not available in this browser.' });
    }
  };

  const handleMarkStaffAlertNoted = (attendanceId) => {
    setNotedStaffAlertIds((currentIds) => (currentIds.includes(attendanceId) ? currentIds : [...currentIds, attendanceId]));
    setBanner({ type: 'success', message: 'Staff alert marked as noted.' });
  };

  const handleContactStaff = async (staffPhone) => {
    if (!staffPhone) {
      setBanner({ type: 'warning', message: 'No phone number is available for this staff member.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(staffPhone);
      setBanner({ type: 'success', message: `Copied ${staffPhone} to clipboard.` });
    } catch {
      setBanner({ type: 'warning', message: 'Clipboard access is not available in this browser.' });
    }
  };

  const handleDeliveryRouting = async (visitorId, resolution) => {
    setUpdatingId(visitorId);
    setBanner({ type: '', message: '' });
    try {
      const updatedVisitor = await routeDelivery(visitorId, resolution, {
        uid: user?.uid || '',
        name: residentUser?.name || 'Resident',
        societyId: user?.societyId,
      });
      const successMessage = resolution === 'security'
        ? `${updatedVisitor.vendorName || updatedVisitor.name} will be held at security.`
        : `${updatedVisitor.vendorName || updatedVisitor.name} approved for doorstep delivery.`;
      setBanner({ type: 'success', message: successMessage });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to update the delivery instructions.' });
    }
    setUpdatingId('');
  };

  const handleDeliveryCollected = async (visitor) => {
    setUpdatingId(visitor.id);
    setBanner({ type: '', message: '' });
    try {
      const updatedVisitor = await markDeliveryCollected(visitor.id, {
        uid: user?.uid || '',
        name: residentUser?.name || 'Resident',
        societyId: user?.societyId,
      });
      setBanner({
        type: 'success',
        message: `${updatedVisitor.vendorName || updatedVisitor.name} marked as collected.`,
      });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to confirm the delivery pickup.' });
    }
    setUpdatingId('');
  };

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleMobileTabChange = (tabKey) => {
    setActiveMobileTab(tabKey);

    if (tabKey === 'visitors') {
      scrollToSection(visitorsSectionRef);
      return;
    }

    if (tabKey === 'staff') {
      scrollToSection(staffSectionRef);
      return;
    }

    if (tabKey === 'delivery') {
      scrollToSection(visitorsSectionRef);
    }
  };

  const handlePrimaryFab = () => {
    if (activeMobileTab === 'staff') {
      openStaffDialog();
      return;
    }

    if (activeMobileTab === 'delivery') {
      openPassDialog('Delivery');
      return;
    }

    openPassDialog('Guest visit');
  };

  const handleSwipeStart = (visitorId, event) => {
    swipeStartRef.current[visitorId] = event.changedTouches[0]?.clientX || 0;
  };

  const handleSwipeEnd = (visitor, event) => {
    const startX = swipeStartRef.current[visitor.id];
    delete swipeStartRef.current[visitor.id];

    if (typeof startX !== 'number') return;

    const endX = event.changedTouches[0]?.clientX || 0;
    const deltaX = endX - startX;
    const swipeThreshold = 72;

    if (Math.abs(deltaX) < swipeThreshold || updatingId === visitor.id) {
      return;
    }

    if (deltaX > 0) {
      void handleVisitorDecision(visitor.id, 'approved');
      return;
    }

    void handleVisitorDecision(visitor.id, 'denied');
  };

  useEffect(() => {
    pendingStaffVisitors.forEach((visitor) => {
      if (autoApprovedStaffVisitorIds.current.has(visitor.id)) return;
      const matchedStaff = staffMembers.find((staffMember) => matchesStaffMember(visitor, staffMember));
      if (!matchedStaff || !isWithinStaffWindow(matchedStaff)) return;

      autoApprovedStaffVisitorIds.current.add(visitor.id);
      void updateVisitorStatus(visitor.id, 'approved', {
        uid: user?.uid || '',
        name: residentUser?.name || 'Resident',
        societyId: user?.societyId,
      }).then(() => {
        setBanner({ type: 'success', message: `${matchedStaff.name} auto-approved for the configured access window.` });
      }).catch(() => {
        autoApprovedStaffVisitorIds.current.delete(visitor.id);
      });
    });
  }, [pendingStaffVisitors, residentUser?.name, staffMembers, user?.societyId, user?.uid]);

  return (
    <Box sx={{ ...dashboardShellSx, pb: { xs: 16, md: 3.5 } }}>
      <Box ref={topSectionRef} sx={{ maxWidth: 1180, mx: 'auto' }}>
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <Box
            component="img"
            src={topIllustration}
            alt=""
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              top: 18,
              left: -100,
              width: 320,
              opacity: 0.22,
              filter: 'sepia(0.35) saturate(0.9)',
            }}
          />
          <Box
            component="img"
            src={topIllustration}
            alt=""
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              top: 22,
              right: -95,
              width: 320,
              opacity: 0.18,
              transform: 'scaleX(-1)',
              filter: 'sepia(0.45) saturate(0.9)',
            }}
          />
          <Box
            component="img"
            src={bottomIllustration}
            alt=""
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              top: 160,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '105%',
              maxWidth: 1400,
              opacity: 0.18,
              filter: 'sepia(0.55) saturate(0.8)',
            }}
          />
        </Box>

        <Paper
          elevation={0}
          sx={{
            ...mobileHeroCardSx,
            display: { xs: 'block', md: 'none' },
            mb: 2,
          }}
        >
          <Box
            component="img"
            src={topIllustration}
            alt=""
            sx={{
              position: 'absolute',
              left: -54,
              bottom: 0,
              width: 180,
              opacity: 0.34,
              filter: 'sepia(0.4) saturate(0.9)',
            }}
          />
          <Box
            component="img"
            src={topIllustration}
            alt=""
            sx={{
              position: 'absolute',
              right: -58,
              bottom: 0,
              width: 180,
              opacity: 0.28,
              transform: 'scaleX(-1)',
              filter: 'sepia(0.45) saturate(0.85)',
            }}
          />

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ flex: 1, textAlign: 'center', px: 2 }}>
              <Typography sx={{ ...templeTitleSx, fontSize: 20, fontWeight: 700 }}>
                Resident Dashboard
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
                <Avatar
                  src={residentAvatarSrc || undefined}
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: 'rgba(255,249,240,0.98)',
                    color: '#8b4b1d',
                    border: '2px solid rgba(177, 121, 48, 0.24)',
                    boxShadow: '0 10px 18px rgba(137, 86, 29, 0.16)',
                    fontWeight: 800,
                  }}
                >
                  {residentInitials}
                </Avatar>
                <Typography sx={{ ...templeTitleSx, fontSize: 16, fontWeight: 700 }}>
                  Namaskara {residentName}{myFlat ? ` · Flat ${myFlat}` : ''}
                </Typography>
              </Stack>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={handleLogout}
              sx={{
                minWidth: 0,
                borderRadius: 999,
                px: 1.4,
                color: '#8b4b1d',
                bgcolor: 'rgba(255,248,237,0.92)',
                borderColor: 'rgba(175, 118, 46, 0.24)',
              }}
            >
              Logout
            </Button>
          </Stack>
        </Paper>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{
            mb: 2.25,
            pt: 1,
            display: { xs: 'none', md: 'flex' },
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ ...templeTitleSx, fontSize: { md: 54, lg: 60 }, lineHeight: 1, fontWeight: 700 }}>
              Resident Dashboard
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mt: 1.5 }}>
              <Avatar
                src={residentAvatarSrc || undefined}
                sx={{
                  width: 46,
                  height: 46,
                  bgcolor: 'rgba(255,249,240,0.98)',
                  color: '#8b4b1d',
                  boxShadow: '0 12px 18px rgba(137, 86, 29, 0.18)',
                  border: '2px solid rgba(177, 121, 48, 0.24)',
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {residentInitials}
              </Avatar>
              <Typography sx={{ ...templeTitleSx, fontSize: { md: 24, lg: 28 }, fontWeight: 700 }}>
                Namaskara {residentName}{myFlat ? ` · Flat ${myFlat}` : ''}
              </Typography>
            </Stack>
            {residentProfileFacts.length ? (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                {residentProfileFacts.slice(0, 3).map((fact) => (
                  <Chip
                    key={fact}
                    label={fact}
                    size="small"
                    sx={{
                      borderRadius: 999,
                      bgcolor: 'rgba(255,247,236,0.84)',
                      color: '#774018',
                      border: '1px solid rgba(177, 121, 48, 0.18)',
                      '& .MuiChip-label': { fontWeight: 700 },
                    }}
                  />
                ))}
              </Stack>
            ) : null}
          </Box>
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{
              borderRadius: 999,
              px: 2.5,
              py: 1.25,
              minWidth: 146,
              alignSelf: 'flex-start',
              bgcolor: 'rgba(255,248,237,0.95)',
              borderColor: 'rgba(175, 118, 46, 0.28)',
              color: '#8b4b1d',
              boxShadow: '0 10px 26px rgba(129, 78, 21, 0.12)',
              '&:hover': {
                borderColor: 'rgba(175, 118, 46, 0.44)',
                bgcolor: 'rgba(255,251,245,0.98)',
              },
            }}
          >
            Logout
          </Button>
        </Stack>

        {banner.message && (
          <Alert severity={banner.type} sx={{ mb: 3, borderRadius: 3 }}>
            {banner.message}
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            display: { xs: 'none', md: 'block' },
            mb: 3,
            p: 0.9,
            borderRadius: 3,
            bgcolor: 'rgba(255, 246, 233, 0.82)',
            border: '1px solid rgba(194, 137, 64, 0.18)',
            boxShadow: '0 12px 26px rgba(120, 74, 24, 0.1)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0.75 }}>
          <Button variant="outlined" startIcon={<CampaignIcon />} onClick={() => navigate('/announcements')} sx={pillButtonSx}>
            Community Updates
          </Button>
          <Button variant="outlined" startIcon={<EventAvailableIcon />} onClick={() => navigate('/bookings')} sx={pillButtonSx}>
            Facility Booking
          </Button>
          <Button variant="outlined" startIcon={<AccountBalanceWalletIcon />} onClick={() => navigate('/expenses')} sx={pillButtonSx}>
            Maintenance Dues
          </Button>
          <Button variant="outlined" startIcon={<BugReportIcon />} onClick={() => navigate('/complaints')} sx={pillButtonSx}>
            Complaint Desk
          </Button>
          <Button variant="outlined" startIcon={<GroupsIcon />} onClick={() => navigate('/directory')} sx={pillButtonSx}>
            Resident Directory
          </Button>
          </Box>
        </Paper>

        {!myFlat && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 3 }}>
            Your profile does not have a flat number yet. Add one in Firestore to receive visitor approvals.
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            ...mobileSectionCardSx,
            display: { xs: 'block', md: 'none' },
            mb: 2,
            p: 1,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 0,
              overflow: 'hidden',
              borderRadius: 999,
              border: '1px solid rgba(166, 115, 45, 0.14)',
              bgcolor: 'rgba(255,250,240,0.88)',
            }}
          >
            <Button variant="text" onClick={() => navigate('/announcements')} sx={mobileActionButtonSx}>
              Updates
            </Button>
            <Button variant="text" onClick={() => navigate('/bookings')} sx={mobileActionButtonSx}>
              Bookings
            </Button>
            <Button variant="text" onClick={() => navigate('/expenses')} sx={mobileActionButtonSx}>
              Dues
            </Button>
            <Button variant="text" onClick={() => navigate('/complaints')} sx={mobileActionButtonSx}>
              Complains
            </Button>
            <Button variant="text" onClick={() => navigate('/directory')} sx={mobileActionButtonSx}>
              Directory
            </Button>
          </Box>
        </Paper>

        <Stack spacing={2} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {activeMobileTab === 'visitors' && (
            <>
              <Paper ref={visitorsSectionRef} elevation={0} sx={compactCardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.75 }}>
                  <Box>
                    <Typography sx={mobileSectionTitleSx}>Pre-Approve Visitor</Typography>
                    <Box sx={{ width: 70, height: 2, bgcolor: 'rgba(207, 140, 58, 0.35)', mt: 0.75 }} />
                  </Box>
                  <Box sx={{ ...ornamentOrbSx, width: 84, height: 84, borderRadius: '26px' }}>
                    <QrCode2Icon sx={{ fontSize: 34 }} />
                  </Box>
                </Stack>

                <Typography sx={{ color: '#6a3618', fontSize: 17, maxWidth: 240, mb: 2.25, lineHeight: 1.5 }}>
                  Generate a QR pass or OTP for your guest.
                </Typography>

                <Button
                  variant="contained"
                  onClick={() => setPassDialogOpen(true)}
                  sx={{
                    minWidth: 170,
                    px: 3,
                    py: 1.2,
                    mb: 2,
                    borderRadius: 999,
                    alignSelf: 'flex-start',
                    background: 'linear-gradient(90deg, #c17306 0%, #a85f06 48%, #cf8b19 100%)',
                    boxShadow: '0 12px 24px rgba(143, 88, 19, 0.24)',
                  }}
                >
                  Create Pass
                </Button>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25, pt: 1.5, borderTop: '1px solid rgba(194, 137, 64, 0.18)' }}>
                  <PersonAddAlt1Icon sx={{ color: '#b76e1e' }} />
                  <Typography sx={{ ...templeTitleSx, fontSize: 18, fontWeight: 700 }}>Unified Approvals</Typography>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
                  <Chip label={`Guests ${approvalOverview.guests}`} sx={{ borderRadius: 999, bgcolor: '#f4c255', color: '#6e3914' }} />
                  <Chip label={`Staff ${approvalOverview.staff}`} sx={{ borderRadius: 999, bgcolor: '#edd3a0', color: '#6e3914' }} />
                  <Chip label={`Delivery ${approvalOverview.delivery}`} sx={{ borderRadius: 999, bgcolor: '#f0b649', color: '#6e3914' }} />
                </Stack>

                {pendingGuestVisitors[0] ? (
                  <Paper
                    variant="outlined"
                    onTouchStart={(event) => handleSwipeStart(pendingGuestVisitors[0].id, event)}
                    onTouchEnd={(event) => handleSwipeEnd(pendingGuestVisitors[0], event)}
                    sx={{
                      p: 1.6,
                      borderRadius: '24px',
                      borderColor: 'rgba(194, 137, 64, 0.18)',
                      bgcolor: 'rgba(255,255,255,0.84)',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 1.75 }}>
                      <Avatar sx={{ width: 48, height: 48, bgcolor: 'rgba(230, 176, 80, 0.26)', color: '#7b3a18', fontWeight: 800 }}>
                        {(formatTextValue(pendingGuestVisitors[0].name, 'V')[0] || 'V').toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ ...templeTitleSx, fontSize: 16, fontWeight: 700 }}>{formatTextValue(pendingGuestVisitors[0].name, 'Visitor')}</Typography>
                        <Typography color="text.secondary">Guest active</Typography>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        disabled={updatingId === pendingGuestVisitors[0].id}
                        onClick={() => handleVisitorDecision(pendingGuestVisitors[0].id, 'approved')}
                        sx={{ minHeight: 52, fontSize: 18, borderRadius: 2.75 }}
                      >
                        Approve
                      </Button>
                      <Button
                        fullWidth
                        variant="contained"
                        color="error"
                        disabled={updatingId === pendingGuestVisitors[0].id}
                        onClick={() => handleVisitorDecision(pendingGuestVisitors[0].id, 'denied')}
                        sx={{ minHeight: 52, fontSize: 18, borderRadius: 2.75 }}
                      >
                        Deny
                      </Button>
                    </Stack>

                    <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                      Swipe right to approve or left to deny
                    </Typography>
                  </Paper>
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: '24px',
                      borderColor: 'rgba(194, 137, 64, 0.18)',
                      bgcolor: 'rgba(255,255,255,0.84)',
                    }}
                  >
                    <Typography variant="subtitle1">No pending approvals</Typography>
                    <Typography color="text.secondary">Create a visitor pass with the plus button or wait for a new gate request.</Typography>
                  </Paper>
                )}
              </Paper>

              <Paper elevation={0} sx={mobileSectionCardSx}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <NotificationsActiveIcon sx={{ color: '#c37d1c' }} />
                  <Typography sx={mobileSectionTitleSx}>Notifications</Typography>
                  <Button size="small" onClick={requestBrowserAlerts} sx={{ ml: 'auto', borderRadius: 999, bgcolor: 'rgba(255,246,231,0.8)' }}>
                    Enable Alerts
                  </Button>
                </Stack>

                {leadNotification ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      borderRadius: '24px',
                      borderColor: 'rgba(194, 137, 64, 0.2)',
                      bgcolor: 'rgba(255,255,255,0.84)',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                      <Chip size="small" label={!leadNotification.read ? 'Alert' : 'Update'} color="warning" sx={{ borderRadius: 999 }} />
                      <Typography sx={{ fontSize: 16.5, color: '#6a3618' }}>Visitor waiting at the gate</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 16.5, color: '#5d3417', fontWeight: 700, mb: 1.5 }}>
                      {formatTextValue(leadNotification.message, 'No message available.')}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: '#efa728' }} />
                      {!leadNotification.read && (
                        <Button size="small" onClick={() => handleMarkNotificationRead(leadNotification.id)} sx={{ borderRadius: 999 }}>
                          Mark Read
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      borderRadius: 4,
                      borderColor: 'rgba(223, 199, 165, 0.48)',
                      bgcolor: 'rgba(255,255,255,0.84)',
                    }}
                  >
                    <Typography variant="subtitle1">No alerts right now</Typography>
                    <Typography color="text.secondary">Resident notifications will appear here when guards or admins trigger them.</Typography>
                  </Paper>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                  <Chip label={`Guests ${approvalOverview.guests}`} color={approvalOverview.guests ? 'warning' : 'default'} sx={{ borderRadius: 999 }} />
                  <Chip label={`Staff ${approvalOverview.staff}`} color={approvalOverview.staff ? 'warning' : 'default'} sx={{ borderRadius: 999 }} />
                  <Chip label={`Delivery ${approvalOverview.delivery}`} color={approvalOverview.delivery ? 'warning' : 'default'} sx={{ borderRadius: 999 }} />
                </Stack>
              </Paper>

              <Paper
                ref={duesSectionRef}
                elevation={0}
                sx={{
                  ...mobileSectionCardSx,
                  p: 2,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ position: 'absolute', right: -16, top: 18, width: 108, height: 108, borderRadius: '32px', background: 'radial-gradient(circle at 35% 30%, rgba(255,224,160,0.95) 0%, rgba(190,135,51,0.95) 58%, rgba(122,77,24,0.84) 100%)', opacity: 0.85 }} />
                <Typography sx={{ ...mobileSectionTitleSx, mb: 1.5 }}>Maintenance Dues</Typography>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Stack spacing={1.1} sx={{ mb: 2 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ color: '#6a3618', fontSize: 16 }}>{residentName}</Typography>
                      <Typography sx={{ ...templeTitleSx, fontSize: 18, fontWeight: 800 }}>{formatCurrency(dueSummary.outstandingAmount)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ color: '#6a3618', fontSize: 16 }}>Next Due</Typography>
                      <Typography sx={{ color: '#6a3618', fontWeight: 700 }}>{formatCurrency(dueSummary.nextDue?.amount || 0)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ color: '#6a3618', fontSize: 16 }}>Due Date</Typography>
                      <Typography sx={{ color: '#6a3618', fontWeight: 700 }}>{formatDateValue(dueSummary.nextDue?.dueDate)}</Typography>
                    </Stack>
                  </Stack>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/expenses')}
                    sx={{
                      minWidth: 136,
                      minHeight: 48,
                      borderRadius: 999,
                      ml: 'auto',
                      display: 'flex',
                      background: 'linear-gradient(90deg, #51693f 0%, #7f8f48 100%)',
                    }}
                  >
                    Pay Now
                  </Button>
                </Box>
              </Paper>
            </>
          )}

          {activeMobileTab === 'staff' && (
            <>
              <Paper ref={staffSectionRef} elevation={0} sx={compactCardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h5" sx={{ fontSize: 24 }}>Verified Staff</Typography>
                  <Button variant="outlined" onClick={() => openStaffDialog()} sx={{ borderRadius: 999 }}>
                    Add New Staff
                  </Button>
                </Stack>
                <Stack spacing={1.2}>
                  {staffMembers.map((staffMember) => (
                    <Paper key={staffMember.id} variant="outlined" sx={{ p: 1.4, borderRadius: 3.5, bgcolor: 'rgba(255,255,255,0.84)' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.25}>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Avatar sx={{ bgcolor: 'rgba(36, 86, 166, 0.12)', color: 'primary.main' }}>
                            {staffMember.name?.[0] || 'S'}
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{staffMember.name}</Typography>
                            <Typography color="text.secondary">{staffMember.roleLabel}</Typography>
                            <Typography color="text.secondary">{formatAccessWindow(staffMember.accessStartTime, staffMember.accessEndTime)}</Typography>
                          </Box>
                        </Stack>
                        <Stack spacing={0.75} alignItems="flex-end">
                          <Chip label={staffMember.autoApproved ? 'Auto-Entry' : 'Manual Review'} color={staffMember.autoApproved ? 'success' : 'default'} sx={{ borderRadius: 999 }} />
                          <Button size="small" onClick={() => openStaffDialog(staffMember)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" onClick={() => handleDeleteStaff(staffMember.id, staffMember.name)}>
                            Remove
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>

              <Paper elevation={0} sx={compactCardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h5" sx={{ fontSize: 24 }}>Pending Staff Entry</Typography>
                  <Chip label={`${approvalOverview.staff} waiting`} color={approvalOverview.staff ? 'warning' : 'default'} sx={{ borderRadius: 999 }} />
                </Stack>
                <Stack spacing={1.1}>
                  {pendingStaffVisitors.length === 0 && (
                    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.84)' }}>
                      <Typography variant="subtitle1">No staff pending</Typography>
                      <Typography color="text.secondary">Recurring staff approvals will appear here when someone reaches the gate.</Typography>
                    </Paper>
                  )}
                  {pendingStaffVisitors.map((visitor) => {
                    const matchedStaff = staffMembers.find((staffMember) => matchesStaffMember(visitor, staffMember));
                    return (
                      <Paper key={visitor.id} variant="outlined" sx={{ p: 1.5, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.84)' }}>
                        <Stack direction="row" justifyContent="space-between" spacing={1.25}>
                          <Box>
                            <Typography variant="h6">{formatTextValue(visitor.name, 'Staff')}</Typography>
                            <Typography color="text.secondary">{formatTextValue(visitor.purpose, matchedStaff?.roleLabel || 'Staff visit')}</Typography>
                            <Typography color="text.secondary">{formatTextValue(visitor.time, 'Arriving now')}</Typography>
                            {matchedStaff && (
                              <Typography color="text.secondary">{matchedStaff.autoApproved ? `Trusted window: ${formatAccessWindow(matchedStaff.accessStartTime, matchedStaff.accessEndTime)}` : 'Manual approval required'}</Typography>
                            )}
                          </Box>
                          <Chip label={matchedStaff?.autoApproved ? 'Trusted' : 'Verify'} color={matchedStaff?.autoApproved ? 'success' : 'warning'} sx={{ borderRadius: 999, height: 'fit-content' }} />
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                          <Button fullWidth variant="contained" color="success" disabled={updatingId === visitor.id} onClick={() => handleVisitorDecision(visitor.id, 'approved')} sx={{ borderRadius: 2.5 }}>
                            Approve
                          </Button>
                          <Button fullWidth variant="outlined" color="error" disabled={updatingId === visitor.id} onClick={() => handleVisitorDecision(visitor.id, 'denied')} sx={{ borderRadius: 2.5 }}>
                            Deny
                          </Button>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Paper>

              <Paper elevation={0} sx={compactCardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h5" sx={{ fontSize: 24 }}>Today's Attendance</Typography>
                  <Button onClick={() => setAttendanceHistoryOpen(true)} sx={{ minWidth: 0 }}>View History</Button>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr 0.9fr', gap: 1, mb: 1.25, px: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Name</Typography>
                  <Typography variant="body2" color="text.secondary">Entry</Typography>
                  <Typography variant="body2" color="text.secondary">Exit</Typography>
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                </Box>
                <Stack spacing={0.85}>
                  {staffAttendance.map((entry) => (
                    <Box key={entry.id} sx={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr 0.9fr', gap: 1, alignItems: 'center', px: 0.5, py: 0.75, borderTop: '1px solid rgba(223,199,165,0.35)' }}>
                      <Typography>{entry.name}</Typography>
                      <Typography>{formatTimeValue(entry.clockInAt)}</Typography>
                      <Typography>{formatTimeValue(entry.clockOutAt)}</Typography>
                      <Chip label={entry.status === 'absent' ? 'Absent' : 'Present'} color={entry.status === 'absent' ? 'warning' : 'success'} size="small" sx={{ borderRadius: 2 }} />
                    </Box>
                  ))}
                </Stack>
                <Button variant="outlined" fullWidth onClick={() => navigate('/complaints?category=staff-access&source=staff')} sx={{ mt: 2, borderRadius: 999 }}>
                  Report an Issue
                </Button>
              </Paper>

              {activeStaffAlert && (
                <Paper elevation={0} sx={{ ...compactCardSx, position: 'relative' }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Chip label="Alert" color="warning" sx={{ borderRadius: 999 }} />
                    <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{activeStaffAlert.alertMessage}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.2} sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={() => handleMarkStaffAlertNoted(activeStaffAlert.id)} sx={{ flex: 1, borderRadius: 2.75 }}>
                      Mark as Noted
                    </Button>
                    <Button variant="outlined" onClick={() => handleContactStaff((staffMembers.find((entry) => entry.id === activeStaffAlert.staffId) || {}).phone)} sx={{ flex: 1, borderRadius: 2.75 }}>
                      Contact Staff
                    </Button>
                  </Stack>
                </Paper>
              )}
            </>
          )}

          {activeMobileTab === 'delivery' && (
            <>
              <Paper ref={visitorsSectionRef} elevation={0} sx={compactCardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h5" sx={{ fontSize: 24 }}>Delivery Approvals</Typography>
                  <Button variant="outlined" onClick={() => openPassDialog('Delivery')} sx={{ borderRadius: 999 }}>
                    Add Delivery
                  </Button>
                </Stack>
                <Stack spacing={1.2}>
                  {pendingDeliveryVisitors.length === 0 && (
                    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.84)' }}>
                      <Typography variant="subtitle1">No deliveries waiting</Typography>
                      <Typography color="text.secondary">New delivery arrivals will show up here with doorstep or security actions.</Typography>
                    </Paper>
                  )}
                  {pendingDeliveryVisitors.map((visitor) => {
                    const vendorMeta = getVendorMeta(visitor);
                    return (
                      <Paper key={visitor.id} variant="outlined" sx={{ p: 1.75, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.84)' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.2}>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                              <Typography variant="h6">{formatTextValue(visitor.name, 'Delivery')}</Typography>
                              <Chip label={vendorMeta.label} size="small" sx={{ borderRadius: 999, bgcolor: vendorMeta.bg, color: vendorMeta.color }} />
                            </Stack>
                            <Typography color="text.secondary">{formatTextValue(visitor.time, formatDateTimeValue(visitor.expectedAt, 'Not scheduled'))}</Typography>
                            <Typography color="text.secondary">{formatTextValue(visitor.purpose, 'Delivery')}</Typography>
                          </Box>
                          <Chip label={getDeliveryStatusLabel(visitor)} color={statusColorMap[visitor.deliveryStatus || visitor.status] || 'default'} sx={{ borderRadius: 999 }} />
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
                          <Button fullWidth variant="contained" disabled={updatingId === visitor.id} onClick={() => handleDeliveryRouting(visitor.id, 'doorstep')} sx={{ borderRadius: 2.5 }}>
                            Deliver to Doorstep
                          </Button>
                          <Button fullWidth variant="outlined" disabled={updatingId === visitor.id} onClick={() => handleDeliveryRouting(visitor.id, 'security')} sx={{ borderRadius: 2.5 }}>
                            Deliver to Security
                          </Button>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Paper>

              <Paper elevation={0} sx={compactCardSx}>
                <Typography variant="h5" sx={{ fontSize: 24, mb: 1.25 }}>AI Concierge Suggestion</Typography>
                <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.84)' }}>
                  <Typography sx={{ fontSize: 17 }}>
                    {pendingDeliveryVisitors[0]
                      ? `Would you like me to approve ${getVendorMeta(pendingDeliveryVisitors[0]).label} for doorstep delivery or send it to security?`
                      : deliveryHistory[0]
                        ? `${getVendorMeta(deliveryHistory[0]).label} was last marked ${getDeliveryStatusLabel(deliveryHistory[0]).toLowerCase()}.`
                        : 'The concierge will flag missed or delayed deliveries here.'}
                  </Typography>
                </Paper>
              </Paper>

              <Paper elevation={0} sx={compactCardSx}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
                  <Typography variant="h5" sx={{ fontSize: 24 }}>Delivery History</Typography>
                  <Chip label={`${deliveryHistory.length} items`} sx={{ borderRadius: 999 }} />
                </Stack>
                <Stack spacing={1}>
                  {deliveryHistory.map((visitor) => {
                    const vendorMeta = getVendorMeta(visitor);
                    return (
                      <Paper key={visitor.id} variant="outlined" sx={{ p: 1.35, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.84)' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.2}>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle1">{vendorMeta.label}</Typography>
                              <Chip label={getDeliveryStatusLabel(visitor)} size="small" color={statusColorMap[visitor.deliveryStatus || visitor.status] || 'default'} sx={{ borderRadius: 999 }} />
                            </Stack>
                            <Typography color="text.secondary">{formatDateValue(visitor.updatedAt || visitor.createdAt)}</Typography>
                            <Typography color="text.secondary">
                              {visitor.deliveryStatus === 'picked_up'
                                ? `Collected by ${formatTextValue(visitor.collectedBy, 'Resident')} on ${formatDateValue(visitor.collectedAt || visitor.updatedAt)}`
                                : visitor.deliveryStatus === 'security_hold_requested'
                                ? 'Awaiting guard acknowledgement'
                                : `Collected by ${formatTextValue(visitor.collectedBy, visitor.deliveryStatus === 'security_received' ? 'Security desk' : 'Resident')}`}
                            </Typography>
                          </Box>
                          <Typography color="text.secondary">{formatTextValue(visitor.name, 'Delivery')}</Typography>
                        </Stack>
                        {canConfirmDeliveryReceipt(visitor) && (
                          <Button
                            fullWidth
                            variant={visitor.deliveryStatus === 'doorstep' ? 'contained' : 'outlined'}
                            disabled={updatingId === visitor.id}
                            onClick={() => handleDeliveryCollected(visitor)}
                            sx={{ mt: 1.25, borderRadius: 2.5 }}
                          >
                            {visitor.deliveryStatus === 'doorstep' ? 'Confirm Received' : 'Mark Picked Up'}
                          </Button>
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
                <Button variant="outlined" fullWidth onClick={() => navigate('/complaints?category=delivery&source=delivery')} sx={{ mt: 2, borderRadius: 999 }}>
                  Report Delivery Issue
                </Button>
              </Paper>
            </>
          )}
        </Stack>

        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr 0.95fr' },
            gap: 2,
            alignItems: 'stretch',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Paper elevation={0} sx={desktopPanelSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2.5 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <PersonAddAlt1Icon sx={{ color: '#b76e1e', fontSize: 30 }} />
                <Typography variant="h5" sx={sectionHeadingSx}>
                  Pre-Approve
                  <br />
                  Visitor
                </Typography>
              </Stack>
              <Box sx={ornamentOrbSx}>
                <QrCode2Icon sx={{ fontSize: 42 }} />
              </Box>
            </Stack>

            <Typography sx={{ color: '#6e4930', fontSize: 17.5, maxWidth: 320, mb: 2.25, lineHeight: 1.55 }}>
              Generate a QR pass or OTP for your guests. Each pass stays valid until two hours after the scheduled arrival.
            </Typography>

            <Button
              variant="contained"
              onClick={() => setPassDialogOpen(true)}
              sx={{
                width: 'fit-content',
                minWidth: 154,
                px: 3,
                py: 1.25,
                mb: 2.5,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #53683f 0%, #916321 100%)',
                boxShadow: '0 12px 24px rgba(111, 83, 30, 0.24)',
                '&:hover': { background: 'linear-gradient(90deg, #4d6038 0%, #865c1f 100%)' },
              }}
            >
              Create Pass
            </Button>

            <Box sx={{ borderTop: '1px solid rgba(187, 145, 82, 0.24)', pt: 2.25 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
                <PersonAddAlt1Icon sx={{ color: '#b76e1e', fontSize: 24 }} />
                <Typography sx={{ ...templeTitleSx, fontSize: 24, fontWeight: 700 }}>
                  Unified Approvals
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`Guests ${approvalOverview.guests}`} sx={{ borderRadius: 999, bgcolor: '#f4c255', color: '#6e3914' }} />
                <Chip label={`Staff ${approvalOverview.staff}`} sx={{ borderRadius: 999, bgcolor: '#edd3a0', color: '#6e3914' }} />
                <Chip label={`Delivery ${approvalOverview.delivery}`} sx={{ borderRadius: 999, bgcolor: '#f0b649', color: '#6e3914' }} />
              </Stack>

              <Stack spacing={1.5}>
                {pendingVisitors.length === 0 && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.25,
                      borderRadius: '28px',
                      borderColor: 'rgba(194, 137, 64, 0.2)',
                      bgcolor: 'rgba(255,255,255,0.76)',
                    }}
                  >
                    <Typography variant="subtitle1">No visitors waiting</Typography>
                    <Typography color="text.secondary">New gate approvals will appear here as soon as guards log them.</Typography>
                  </Paper>
                )}
                {pendingVisitors.slice(0, 2).map((visitor) => (
                  <Paper
                    key={visitor.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: '28px',
                      borderColor: 'rgba(194, 137, 64, 0.22)',
                      bgcolor: 'rgba(255,253,247,0.82)',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                      <Avatar sx={{ width: 48, height: 48, bgcolor: 'rgba(230, 176, 80, 0.26)', color: '#7b3a18', fontWeight: 800 }}>
                        {(formatTextValue(visitor.name, 'V')[0] || 'V').toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography sx={{ ...templeTitleSx, fontSize: 18, fontWeight: 700 }}>
                          {formatTextValue(visitor.name, 'Visitor')}
                        </Typography>
                        <Typography color="text.secondary">{formatTextValue(visitor.purpose, 'Guest active')}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.2}>
                      <Button
                        variant="contained"
                        color="success"
                        disabled={updatingId === visitor.id}
                        onClick={() => handleVisitorDecision(visitor.id, 'approved')}
                        sx={{ minWidth: 96 }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={updatingId === visitor.id}
                        onClick={() => handleVisitorDecision(visitor.id, 'denied')}
                        sx={{ minWidth: 88, bgcolor: 'rgba(255,255,255,0.72)' }}
                      >
                        Deny
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Paper>

          <Paper elevation={0} sx={desktopPanelSx}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.25 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <NotificationsActiveIcon sx={{ color: '#c37d1c' }} />
                <Typography variant="h4" sx={{ ...templeTitleSx, fontSize: 24 }}>
                  Notifications
                </Typography>
              </Stack>
              <Button size="small" onClick={requestBrowserAlerts} sx={{ borderRadius: 999, bgcolor: 'rgba(255,246,231,0.8)' }}>
                Enable Alerts
              </Button>
            </Stack>

            {leadNotification ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: '30px',
                  mb: 1.5,
                  borderColor: 'rgba(194, 137, 64, 0.22)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.93) 0%, rgba(255,249,240,0.88) 100%)',
                  boxShadow: '0 12px 28px rgba(129, 78, 21, 0.1)',
                }}
              >
                <Typography sx={{ fontSize: 18, mb: 1.5, color: '#5d3417', fontWeight: 700 }}>
                  {formatTextValue(leadNotification.message, 'No message available.')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <Chip
                    size="small"
                    label={!leadNotification.read ? 'Alert' : 'Update'}
                    color={!leadNotification.read ? 'warning' : 'default'}
                    sx={{ borderRadius: 999 }}
                  />
                  <Typography variant="subtitle1">{formatTextValue(leadNotification.title, 'Notification')}</Typography>
                </Stack>
                <Typography color="text.secondary">{formatTextValue(leadNotification.title, 'Notification')}</Typography>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: '30px',
                  borderColor: 'rgba(194, 137, 64, 0.22)',
                  bgcolor: 'rgba(255,255,255,0.72)',
                }}
              >
                <Stack spacing={1} alignItems="flex-start">
                  <NotificationsNoneIcon color="disabled" />
                  <Typography variant="subtitle1">No notifications yet</Typography>
                  <Typography color="text.secondary">Gate alerts and resident updates will appear here.</Typography>
                </Stack>
              </Paper>
            )}

            <Stack spacing={1.2} sx={{ mt: 2.2 }}>
              {notifications.slice(0, 3).map((notification) => (
                <Paper
                  key={notification.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: '24px',
                    borderColor: 'rgba(194, 137, 64, 0.2)',
                    bgcolor: 'rgba(255,255,255,0.68)',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>{formatTextValue(notification.title, 'Notification')}</Typography>
                      <Typography color="text.secondary" variant="body2" noWrap>{formatTextValue(notification.message, 'No message available.')}</Typography>
                    </Box>
                    {!notification.read && (
                      <Button size="small" onClick={() => handleMarkNotificationRead(notification.id)}>
                        Mark Read
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              ...desktopPanelSx,
              background: 'linear-gradient(180deg, rgba(255,247,232,0.95) 0%, rgba(250,236,202,0.92) 100%)',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <AccountBalanceWalletIcon sx={{ color: '#c37d1c' }} />
              <Typography variant="h4" sx={{ ...templeTitleSx, fontSize: 24 }}>
                Maintenance Dues
              </Typography>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: '30px',
                mb: 2.2,
                borderColor: 'rgba(194, 137, 64, 0.24)',
                bgcolor: 'rgba(255,251,243,0.88)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ position: 'absolute', right: -22, top: 10, width: 120, height: 120, borderRadius: '38px', background: 'radial-gradient(circle at 35% 30%, rgba(255,224,160,0.95) 0%, rgba(190,135,51,0.95) 58%, rgba(122,77,24,0.84) 100%)', opacity: 0.8 }} />
              <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Typography color="text.secondary">{residentName} owes</Typography>
                  <Typography color="text.secondary" sx={{ mt: 2 }}>Next due amount</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1.5 }}>Due date</Typography>
                </Box>
                <Box sx={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
                  <Typography variant="h4" sx={{ ...templeTitleSx, fontSize: { xs: 28, md: 40 }, mb: 2 }}>
                    {formatCurrency(dueSummary.outstandingAmount)}
                  </Typography>
                  <Typography sx={{ color: '#8b4b1d', fontWeight: 700 }}>
                    {formatCurrency(dueSummary.nextDue?.amount || 0)}
                  </Typography>
                  <Typography sx={{ mt: 1.25, fontWeight: 700, color: '#6a3618' }}>
                    {formatDateValue(dueSummary.nextDue?.dueDate)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Chip
              label={`${dueSummary.openCount} open bill${dueSummary.openCount === 1 ? '' : 's'}`}
              sx={{ mb: 2.5, bgcolor: 'rgba(255,247,235,0.92)', color: '#6a3618', borderRadius: 999 }}
            />

            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate('/expenses')}
              sx={{
                minHeight: 52,
                borderRadius: 999,
                fontSize: 22,
                background: 'linear-gradient(90deg, #51693f 0%, #7f8f48 100%)',
                boxShadow: '0 12px 24px rgba(78, 105, 63, 0.24)',
                '&:hover': { background: 'linear-gradient(90deg, #4b613a 0%, #738143 100%)' },
              }}
            >
              Pay Now
            </Button>
          </Paper>

          <Box sx={{ gridColumn: { xs: '1', lg: '2 / 4' } }}>
            <Paper
              elevation={0}
              sx={{
                ...desktopPanelSx,
                p: 0,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(248, 225, 181, 0.72) 0%, rgba(242, 214, 162, 0.82) 44%, rgba(223, 184, 109, 0.72) 100%)',
              }}
            >
              <Box
                sx={{
                  px: { xs: 2, md: 3 },
                  py: { xs: 2.5, md: 2.75 },
                  position: 'relative',
                  minHeight: 180,
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2.5}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                      sx={{
                        position: 'relative',
                        width: 88,
                        height: 88,
                        borderRadius: '50%',
                        background: 'conic-gradient(from 18deg, #b86e1f 0deg 292deg, rgba(255,255,255,0.65) 292deg 360deg)',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        sx={{
                          width: 68,
                          height: 68,
                          borderRadius: '50%',
                          bgcolor: 'rgba(255, 248, 235, 0.94)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 800,
                          color: '#7a4119',
                          fontSize: 18,
                        }}
                      >
                        {spotlightVisitor ? 'Alert' : 'Ready'}
                      </Box>
                    </Box>

                    <Box>
                      <Typography sx={{ fontSize: 18, color: '#8a4b1d', mb: 0.5, fontWeight: 700 }}>
                        {spotlightVisitor?.status === 'preapproved' ? 'Open pre-approved pass' : spotlightVisitor?.status === 'pending' ? 'Open visitor approval' : 'Visitor update'}
                      </Typography>
                      <Typography variant="h5" sx={{ ...templeTitleSx, mb: 0.5 }}>
                        {formatTextValue(spotlightVisitor?.name, spotlightVisitor ? 'Visitor' : 'No active pass yet')}
                      </Typography>
                      <Typography sx={{ color: '#6a3618' }}>
                        {spotlightVisitor
                          ? formatTextValue(spotlightVisitor.purpose, 'Guest visit')
                          : 'Create a pass to keep guest entry smooth at the gate.'}
                      </Typography>
                      <Typography sx={{ color: '#6a3618', mt: 0.5 }}>
                        {spotlightVisitor?.otp
                          ? `OTP: ${spotlightVisitor.otp}`
                          : spotlightVisitor?.expectedAt
                            ? `Arrival: ${formatDateTimeValue(spotlightVisitor.expectedAt)}`
                            : 'Resident concierge is ready for the next request.'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1.25}>
                    <Chip
                      icon={<SmartToyIcon />}
                      label="AI Concierge active"
                      sx={{
                        bgcolor: 'rgba(255,248,236,0.9)',
                        borderRadius: 999,
                        color: '#6a3618',
                        '& .MuiChip-icon': { color: '#d48b33' },
                      }}
                    />
                    <Stack direction="row" spacing={1}>
                      {spotlightVisitor?.otp && (
                        <Button variant="outlined" onClick={() => handleCopyPassText(spotlightVisitor.otp, 'OTP copied to clipboard.')}>
                          Copy OTP
                        </Button>
                      )}
                      <Button variant="contained" onClick={() => navigate('/expenses')} startIcon={<CreditCardIcon />}>
                        Open Dues
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      <ChatbotWidget
        variant="bubble"
        greetingName={residentFirstName}
        bottomOffset={{ xs: 104, md: 24 }}
        title="Resident AI Concierge"
      />

      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          px: 1.5,
          zIndex: 1100,
        }}
      >
        <Box sx={{ maxWidth: 430, mx: 'auto', position: 'relative' }}>
          <Paper
            elevation={10}
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 72px 1fr 1fr',
              alignItems: 'center',
              px: 1,
              py: 1.2,
              borderRadius: 999,
              bgcolor: 'rgba(255, 250, 242, 0.98)',
              border: '1px solid rgba(223, 199, 165, 0.46)',
              boxShadow: '0 18px 34px rgba(120, 108, 88, 0.16)',
            }}
          >
            <ButtonBase onClick={() => scrollToSection(topSectionRef)} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <HomeIcon sx={{ color: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5 }}>Home</Typography>
              </Stack>
            </ButtonBase>

            <ButtonBase onClick={() => handleMobileTabChange('visitors')} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <QrCode2Icon sx={{ color: activeMobileTab === 'visitors' ? 'primary.main' : 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5, color: activeMobileTab === 'visitors' ? 'primary.main' : 'text.secondary' }}>Visitors</Typography>
              </Stack>
            </ButtonBase>

            <Box />

            <ButtonBase onClick={() => handleMobileTabChange('delivery')} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <BoltIcon sx={{ color: activeMobileTab === 'delivery' ? 'primary.main' : 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5, color: activeMobileTab === 'delivery' ? 'primary.main' : 'text.secondary' }}>Delivery</Typography>
              </Stack>
            </ButtonBase>

            <ButtonBase onClick={() => navigate('/profile')} sx={{ borderRadius: 3, py: 0.5 }}>
              <Stack spacing={0.35} alignItems="center">
                <PersonIcon sx={{ color: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontSize: 12.5 }}>Profile</Typography>
              </Stack>
            </ButtonBase>
          </Paper>

          <Button
            variant="contained"
            onClick={handlePrimaryFab}
            sx={{
              position: 'absolute',
              left: '50%',
              top: -26,
              transform: 'translateX(-50%)',
              minWidth: 72,
              width: 72,
              height: 72,
              borderRadius: '50%',
              boxShadow: '0 18px 30px rgba(36, 86, 166, 0.34)',
            }}
          >
            <AddIcon sx={{ fontSize: 34 }} />
          </Button>
        </Box>
      </Box>

      <Dialog
        open={staffDialogOpen}
        onClose={() => {
          if (creatingStaff) return;
          setStaffDialogOpen(false);
          setEditingStaffId('');
          setStaffForm(defaultStaffForm);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editingStaffId ? 'Edit Staff' : 'Add New Staff'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Staff name" name="name" value={staffForm.name} onChange={handleStaffFormChange} fullWidth />
            <TextField select label="Role" name="roleLabel" value={staffForm.roleLabel} onChange={handleStaffFormChange} fullWidth>
              <MenuItem value="Maid">Maid</MenuItem>
              <MenuItem value="Driver">Driver</MenuItem>
              <MenuItem value="Cook">Cook</MenuItem>
              <MenuItem value="Nanny">Nanny</MenuItem>
              <MenuItem value="Caretaker">Caretaker</MenuItem>
            </TextField>
            <TextField label="Phone" name="phone" value={staffForm.phone} onChange={handleStaffFormChange} fullWidth />
            <TextField select label="Access mode" name="autoApproved" value={String(staffForm.autoApproved)} onChange={handleStaffFormChange} fullWidth>
              <MenuItem value="true">Auto-approve in access window</MenuItem>
              <MenuItem value="false">Manual approval every time</MenuItem>
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Allowed from" name="accessStartTime" type="time" value={staffForm.accessStartTime} onChange={handleStaffFormChange} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField label="Allowed until" name="accessEndTime" type="time" value={staffForm.accessEndTime} onChange={handleStaffFormChange} InputLabelProps={{ shrink: true }} fullWidth />
            </Stack>
            <TextField label="Notes" name="notes" value={staffForm.notes} onChange={handleStaffFormChange} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setStaffDialogOpen(false);
              setEditingStaffId('');
              setStaffForm(defaultStaffForm);
            }}
            disabled={creatingStaff}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveStaff} disabled={creatingStaff}>
            {creatingStaff ? (editingStaffId ? 'Saving...' : 'Adding...') : (editingStaffId ? 'Save Changes' : 'Add Staff')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={attendanceHistoryOpen} onClose={() => setAttendanceHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Staff Attendance History</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 1 }}>
            {staffAttendance.map((entry) => (
              <Paper key={entry.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="subtitle1">{entry.name}</Typography>
                    <Typography color="text.secondary">{entry.roleLabel}</Typography>
                    <Typography color="text.secondary">Entry: {formatTimeValue(entry.clockInAt)}</Typography>
                    <Typography color="text.secondary">Exit: {formatTimeValue(entry.clockOutAt)}</Typography>
                  </Box>
                  <Chip label={entry.status === 'absent' ? 'Absent' : 'Present'} color={entry.status === 'absent' ? 'warning' : 'success'} />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttendanceHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passDialogOpen} onClose={() => !creatingPass && setPassDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Visitor Pass</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Visitor name" name="visitorName" value={passForm.visitorName} onChange={handlePassFormChange} fullWidth />
            <TextField label="Purpose" name="purpose" value={passForm.purpose} onChange={handlePassFormChange} fullWidth />
            <TextField label="Phone" name="phone" value={passForm.phone} onChange={handlePassFormChange} fullWidth />
            <TextField
              label="Expected arrival"
              name="expectedAt"
              type="datetime-local"
              value={passForm.expectedAt}
              onChange={handlePassFormChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField label="Notes" name="notes" value={passForm.notes} onChange={handlePassFormChange} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPassDialogOpen(false)} disabled={creatingPass}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePass} disabled={creatingPass}>
            {creatingPass ? 'Creating...' : 'Generate Pass'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(createdPass)} onClose={() => setCreatedPass(null)} fullWidth maxWidth="sm">
        <DialogTitle>Visitor Pass Ready</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1, alignItems: 'center', textAlign: 'center' }}>
            <Typography variant="h6">{formatTextValue(createdPass?.visitorName, 'Visitor')}</Typography>
            <Typography color="text.secondary">
              Expected at {formatDateTimeValue(createdPass?.expectedAt, 'the scheduled time')}
            </Typography>
            <Typography color="text.secondary">
              Valid until {formatDateTimeValue(createdPass?.passExpiresAt, 'two hours after arrival')}
            </Typography>
            {createdPass?.qrPayload && (
              <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 2 }}>
                <QRCode value={createdPass.qrPayload} size={180} />
              </Box>
            )}
            <Chip color="primary" label={`OTP ${createdPass?.otp || ''}`} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button onClick={() => handleCopyPassText(createdPass?.otp || '', 'OTP copied to clipboard.')}>Copy OTP</Button>
              <Button onClick={() => handleCopyPassText(createdPass?.qrPayload || '', 'QR payload copied to clipboard.')}>Copy QR Payload</Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatedPass(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
