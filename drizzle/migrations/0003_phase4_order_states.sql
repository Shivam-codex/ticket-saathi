alter type public.order_status add value if not exists 'payment_pending';
alter type public.order_status add value if not exists 'ticket_delivered';