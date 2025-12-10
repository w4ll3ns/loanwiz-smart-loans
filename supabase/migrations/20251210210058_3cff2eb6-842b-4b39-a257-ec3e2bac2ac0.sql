-- Corrigir as datas das parcelas do contrato da Railene Lima Raiol
-- O contrato é diário com domingo não permitido

-- Parcela 5: estava 15/12, deve ser 16/12
UPDATE parcelas SET data_vencimento = '2025-12-16' 
WHERE id = '3ab47604-64bf-42c7-ac25-1607064b7c8b';

-- Parcela 6: estava 16/12, deve ser 17/12
UPDATE parcelas SET data_vencimento = '2025-12-17' 
WHERE id = 'c286c6f8-397f-47ba-86a6-4a7da09e6633';

-- Parcela 7: estava 17/12, deve ser 18/12
UPDATE parcelas SET data_vencimento = '2025-12-18' 
WHERE id = '3a8bb8a0-c260-4ecc-9e95-2b8d3721e83a';

-- Parcela 8: estava 18/12, deve ser 19/12
UPDATE parcelas SET data_vencimento = '2025-12-19' 
WHERE id = 'e70ec4d3-74c4-4acd-b7dc-fa137510a61a';

-- Parcela 9: estava 19/12, deve ser 20/12
UPDATE parcelas SET data_vencimento = '2025-12-20' 
WHERE id = '03d47182-861c-459c-a270-be856fe1e823';

-- Parcela 10: estava 20/12, deve ser 22/12 (pula domingo 21)
UPDATE parcelas SET data_vencimento = '2025-12-22' 
WHERE id = 'f958e724-e5ea-499c-b1f7-82697b4bc50c';

-- Parcela 11: estava 22/12, deve ser 23/12
UPDATE parcelas SET data_vencimento = '2025-12-23' 
WHERE id = '925b90f5-a14e-4b4f-a38a-6bdbc1fed0a8';

-- Parcela 12: estava 22/12, deve ser 24/12
UPDATE parcelas SET data_vencimento = '2025-12-24' 
WHERE id = '4172f585-8744-40ce-8e77-fd866ceedcf7';

-- Parcela 13: estava 23/12, deve ser 25/12
UPDATE parcelas SET data_vencimento = '2025-12-25' 
WHERE id = 'c916efbf-88d0-4f89-844e-124235d94a0a';

-- Parcela 14: estava 24/12, deve ser 26/12
UPDATE parcelas SET data_vencimento = '2025-12-26' 
WHERE id = '1c9a11bb-ed8d-4832-bfeb-ee6c14f0e151';

-- Parcela 15: estava 25/12, deve ser 27/12
UPDATE parcelas SET data_vencimento = '2025-12-27' 
WHERE id = '58f570dd-84b6-4b29-8edb-bf3475bd1cdd';