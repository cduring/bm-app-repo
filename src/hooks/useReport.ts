import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface ReportContentVars {
  myProfileId: string;
  myDisplayName: string;
  myEmail: string;
  reportedProfileId?: string;
  reportedDisplayName?: string;
  reportedEventId?: string;
  reportedEventTitle?: string;
  reason: string;
}

export function useReportContent() {
  return useMutation({
    mutationFn: async ({
      myProfileId,
      myDisplayName,
      myEmail,
      reportedProfileId,
      reportedDisplayName,
      reportedEventId,
      reportedEventTitle,
      reason,
    }: ReportContentVars) => {
      const { error } = await supabase.from('content_reports').insert({
        reporter_id: myProfileId,
        reported_profile_id: reportedProfileId ?? null,
        reported_event_id: reportedEventId ?? null,
        reason,
      });
      if (error) throw error;

      await supabase.functions.invoke('send-email', {
        body: {
          type: 'report_content',
          fromUser: { email: myEmail, displayName: myDisplayName },
          payload: {
            reportedProfileId: reportedProfileId ?? null,
            reportedDisplayName: reportedDisplayName ?? null,
            reportedEventId: reportedEventId ?? null,
            reportedEventTitle: reportedEventTitle ?? null,
            reason,
          },
        },
      });
    },
  });
}
