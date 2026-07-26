
UPDATE public.job_titles SET is_canonical = TRUE
 WHERE id = '6b1e8e9f-643c-4c0a-9b91-7dc0c6b6b932';

UPDATE public.employees
   SET job_title_id = '6b1e8e9f-643c-4c0a-9b91-7dc0c6b6b932'
 WHERE unit_id = 'e2ad5403-dcfb-4a70-a9cc-15106bb348f5'
   AND active
   AND job_title_id IS NULL
   AND job_title = 'AUXILIAR ADMINISTRATIVO';
