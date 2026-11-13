import React, { useEffect, useState } from 'react';
import { ensurePlayerSession, type PlayerProfile } from '../lib/supabase';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function CommanderPassButton({
  onUnlock,
}: {
  onUnlock?: (isCommander: boolean) => void;
}) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensurePlayerSession().then((p) => {
      setProfile(p);
      if (p?.is_commander && onUnlock) onUnlock(true);
    });
  }, []);

  const handleUpgrade = async () => {
    if (!profile) return alert('Connecting to player profile... try again in a second.');
    setLoading(true);

    try {
      // 1. Create ₹99 order on your Express backend
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id }),
      });
      const orderData = await orderRes.json();
      if (!orderData.orderId) throw new Error('Order creation failed');

      // 2. Open Razorpay UPI / Card popup
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'ShadowPulse Tactical',
        description: 'Commander VIP Pass (Custom Rooms & 12-Player Lobbies)',
        order_id: orderData.orderId,
        theme: { color: '#ef4444' },
        handler: async function (response: any) {
          // 3. Verify signature on backend & unlock in Supabase
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: profile.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setProfile({ ...profile, is_commander: true });
            if (onUnlock) onUnlock(true);
            alert('Commander Pass Unlocked! VIP Host controls are now active.');
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert('Could not start checkout. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.is_commander) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold tracking-wider uppercase text-center">
        ★ COMMANDER VIP ACTIVE
      </div>
    );
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 text-white font-bold text-sm shadow-lg active:scale-95 transition"
    >
      {loading ? 'Opening Checkout...' : '⚡ Unlock Commander Pass — ₹99'}
    </button>
  );
}

