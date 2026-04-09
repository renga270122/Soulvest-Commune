import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  CardMedia,
  Box,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
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

const MAX_MARKETPLACE_PHOTOS = 4;

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to read one of the selected photos.'));
      image.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => reject(new Error('Unable to read one of the selected photos.'));
    reader.readAsDataURL(file);
  });
}

async function compressMarketplacePhoto(file) {
  const image = await loadImageFile(file);
  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to prepare marketplace photos right now.');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

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
    photos: [],
  });
  const photoInputRef = useRef(null);
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
        photos: form.photos,
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
        photos: [],
      });
      setDialogOpen(false);
      setBanner({ type: 'success', message: 'Marketplace listing posted successfully.' });
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to post marketplace listing.' });
    }

    setSaving(false);
  };

  const handlePhotoSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const remainingSlots = MAX_MARKETPLACE_PHOTOS - form.photos.length;
    if (remainingSlots <= 0) {
      setBanner({ type: 'error', message: `You can upload up to ${MAX_MARKETPLACE_PHOTOS} photos per listing.` });
      event.target.value = '';
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);

    try {
      const nextPhotos = await Promise.all(selectedFiles.map((file) => compressMarketplacePhoto(file)));
      setForm((current) => ({
        ...current,
        photos: [...current.photos, ...nextPhotos],
      }));
      if (files.length > remainingSlots) {
        setBanner({ type: 'info', message: `Only the first ${MAX_MARKETPLACE_PHOTOS} photos were added.` });
      }
    } catch (error) {
      setBanner({ type: 'error', message: error.message || 'Unable to add marketplace photos.' });
    }

    event.target.value = '';
  };

  const handleRemovePhoto = (photoIndex) => {
    setForm((current) => ({
      ...current,
      photos: current.photos.filter((_, index) => index !== photoIndex),
    }));
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
            const listingPhotos = Array.isArray(listing.photos) ? listing.photos : [];
            return (
              <Paper key={listing.id} elevation={2} sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack spacing={1.5}>
                  {listingPhotos.length > 0 ? (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: listingPhotos.length === 1 ? '1fr' : { xs: '1fr 1fr', md: '1.4fr 1fr' },
                        gap: 1,
                      }}
                    >
                      <CardMedia
                        component="img"
                        image={listingPhotos[0]}
                        alt={listing.title}
                        sx={{ height: 220, borderRadius: 2, objectFit: 'cover' }}
                      />
                      {listingPhotos.length > 1 ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1 }}>
                          {listingPhotos.slice(1, 3).map((photo, index) => (
                            <CardMedia
                              key={`${listing.id}-photo-${index + 1}`}
                              component="img"
                              image={photo}
                              alt={`${listing.title} ${index + 2}`}
                              sx={{ height: 106, borderRadius: 2, objectFit: 'cover' }}
                            />
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}

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
            <Stack spacing={1.25}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Box>
                  <Typography variant="subtitle1">Photos</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add up to {MAX_MARKETPLACE_PHOTOS} photos to help residents understand the item faster.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => photoInputRef.current?.click()}
                >
                  Upload Photos
                </Button>
              </Stack>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handlePhotoSelection}
              />
              {form.photos.length > 0 ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.25 }}>
                  {form.photos.map((photo, index) => (
                    <Box key={`photo-preview-${index}`} sx={{ position: 'relative' }}>
                      <CardMedia
                        component="img"
                        image={photo}
                        alt={`Listing photo ${index + 1}`}
                        sx={{ height: 112, borderRadius: 2, objectFit: 'cover' }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemovePhoto(index)}
                        sx={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          bgcolor: 'rgba(255,255,255,0.94)',
                          '&:hover': { bgcolor: '#fff' },
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Stack>
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