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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SellIcon from '@mui/icons-material/Sell';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Navbar from '../components/Navbar';
import { useAuthContext } from '../components/auth-context';
import {
  createMarketplaceListing,
  subscribeToMarketplaceListings,
} from '../services/communityData';

const categoryOptions = [
  { value: 'general', label: 'General' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliances' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'kids', label: 'Kids' },
];

const conditionOptions = [
  { value: 'new', label: 'New' },
  { value: 'like-new', label: 'Like New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' },
];

const listingTypeOptions = [
  { value: 'sell', label: 'For Sale' },
  { value: 'buy', label: 'Wanted' },
];

const formatTimestamp = (value) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleString();
};

const formatPrice = (value) => {
  const amount = Number(value || 0);
  return amount > 0 ? `Rs. ${amount.toLocaleString('en-IN')}` : 'Price on request';
};

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [banner, setBanner] = useState({ type: '', message: '' });
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    condition: 'good',
    listingType: 'sell',
    price: '',
  });
  const { user } = useAuthContext();
  const canPost = ['resident', 'admin'].includes(user?.role);

  useEffect(() => {
    const unsubscribe = subscribeToMarketplaceListings((items) => {
      setListings(items);
      setLoading(false);
    }, user);
    return () => unsubscribe();
  }, [user]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesCategory = categoryFilter === 'all' || listing.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;

      const haystack = `${listing.title || ''} ${listing.description || ''} ${listing.residentName || ''} ${listing.flat || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [categoryFilter, listings, search]);

  const stats = useMemo(() => ({
    active: listings.filter((item) => String(item.status || 'active').toLowerCase() === 'active').length,
    mine: listings.filter((item) => item.residentId === user?.uid).length,
    wanted: listings.filter((item) => item.listingType === 'buy').length,
  }), [listings, user?.uid]);

  const handleCreateListing = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setBanner({ type: 'error', message: 'Title and description are required.' });
      return;
    }

    setSaving(true);
    setBanner({ type: '', message: '' });

    try {
      await createMarketplaceListing({
        title: form.title,
        description: form.description,
        category: form.category,
        condition: form.condition,
        listingType: form.listingType,
        price: form.price,
        residentId: user?.uid,
        residentName: user?.name || 'Resident',
        flat: user?.flat || '',
        societyId: user?.societyId,
      });

      setForm({
        title: '',
        description: '',
        category: 'general',
        condition: 'good',
        listingType: 'sell',
        price: '',
      });
      setDialogOpen(false);
      setBanner({ type: 'success', message: 'Marketplace listing posted successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to post marketplace listing.' });
    }

    setSaving(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: 2, py: 3, pb: 11 }}>
      <Box sx={{ maxWidth: 1160, mx: 'auto' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h4">Community Marketplace</Typography>
            <Typography color="text.secondary">
              Browse resident listings, post items for sale, and keep transactions inside the society network.
            </Typography>
          </Box>
          {canPost ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              New Listing
            </Button>
          ) : null}
        </Stack>

        {banner.message ? <Alert severity={banner.type} sx={{ mb: 3 }}>{banner.message}</Alert> : null}

        <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 0.75 }}>A resident-first buying and selling hub</Typography>
              <Typography color="text.secondary">
                Show how residents can discover listings inside the society, post items quickly, and keep commerce local to the community.
              </Typography>
            </Box>
            <Chip label={canPost ? 'Posting enabled for demo' : 'Browse-only access'} color="primary" variant="outlined" />
          </Stack>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Active Listings</Typography>
            <Typography variant="h4">{stats.active}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Your Listings</Typography>
            <Typography variant="h4">{stats.mine}</Typography>
          </Paper>
          <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3 }}>
            <Typography color="text.secondary">Wanted Posts</Typography>
            <Typography variant="h4">{stats.wanted}</Typography>
          </Paper>
        </Box>

        <Paper elevation={1} sx={{ p: 2, borderRadius: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              label="Search listings"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              sx={{ minWidth: { xs: '100%', md: 180 } }}
            >
              <MenuItem value="all">All categories</MenuItem>
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Paper>

        <Stack spacing={2}>
          {!loading && filteredListings.length === 0 ? (
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ mb: 0.75 }}>No listings found</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {search || categoryFilter !== 'all'
                  ? 'Try a broader search or reset the filter to see more resident listings.'
                  : 'Post the first listing for your block to demonstrate community buying and selling.'}
              </Typography>
              <Stack direction="row" spacing={1}>
                {(search || categoryFilter !== 'all') ? (
                  <Button variant="outlined" onClick={() => { setSearch(''); setCategoryFilter('all'); }}>
                    Clear filters
                  </Button>
                ) : null}
                {canPost ? (
                  <Button variant="contained" onClick={() => setDialogOpen(true)}>
                    New Listing
                  </Button>
                ) : null}
              </Stack>
            </Paper>
          ) : null}

          {filteredListings.map((listing) => {
            const isOwnListing = listing.residentId === user?.uid;
            return (
              <Paper key={listing.id} elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, flexWrap: 'wrap' }}>
                        <Typography variant="h6">{listing.title}</Typography>
                        <Chip
                          size="small"
                          icon={listing.listingType === 'buy' ? <ShoppingBagIcon /> : <SellIcon />}
                          label={listing.listingType === 'buy' ? 'Wanted' : 'For Sale'}
                          color={listing.listingType === 'buy' ? 'secondary' : 'primary'}
                        />
                        {isOwnListing ? <Chip size="small" label="Your post" color="success" /> : null}
                      </Stack>
                      <Typography color="text.secondary">{listing.description}</Typography>
                    </Box>
                    <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1}>
                      <Typography variant="h6">{formatPrice(listing.price)}</Typography>
                      <Typography color="text.secondary">{formatTimestamp(listing.createdAt)}</Typography>
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" icon={<StorefrontIcon />} label={(listing.category || 'general').replace(/-/g, ' ')} variant="outlined" />
                    <Chip size="small" label={(listing.condition || 'good').replace(/-/g, ' ')} variant="outlined" />
                    <Chip size="small" label={`${listing.residentName || 'Resident'}${listing.flat ? ` • ${listing.flat}` : ''}`} />
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Box>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Marketplace Listing</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} fullWidth />
            <TextField label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} multiline minRows={4} fullWidth />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField select label="Listing type" value={form.listingType} onChange={(event) => setForm((current) => ({ ...current, listingType: event.target.value }))} fullWidth>
                {listingTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} fullWidth>
                {categoryOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField select label="Condition" value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} fullWidth>
                {conditionOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField label="Price" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="e.g. 4500" fullWidth />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateListing} disabled={saving}>
            {saving ? 'Posting...' : 'Post Listing'}
          </Button>
        </DialogActions>
      </Dialog>

      <Navbar />
    </Box>
  );
}