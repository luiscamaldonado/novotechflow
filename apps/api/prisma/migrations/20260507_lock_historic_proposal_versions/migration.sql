-- Lock historic proposal versions: every proposal whose group has a higher version than itself.
-- Group identity = proposal_code without the trailing "-N".
UPDATE proposals AS p
SET is_locked = true
WHERE p.proposal_code IS NOT NULL
  AND p.proposal_code ~ '-[0-9]+$'
  AND EXISTS (
    SELECT 1
    FROM proposals AS p2
    WHERE p2.proposal_code IS NOT NULL
      AND p2.proposal_code ~ '-[0-9]+$'
      AND substring(p2.proposal_code from '^(.*)-[0-9]+$') = substring(p.proposal_code from '^(.*)-[0-9]+$')
      AND CAST(substring(p2.proposal_code from '-([0-9]+)$') AS INTEGER) > CAST(substring(p.proposal_code from '-([0-9]+)$') AS INTEGER)
  );
