
-- Notification logs table
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'sent',
  message_body TEXT,
  notification_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate notifications per schedule per channel per day
CREATE UNIQUE INDEX idx_notification_logs_unique_daily 
  ON public.notification_logs (schedule_id, channel, notification_date);

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notification logs"
  ON public.notification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert notification logs"
  ON public.notification_logs FOR INSERT
  WITH CHECK (true);
