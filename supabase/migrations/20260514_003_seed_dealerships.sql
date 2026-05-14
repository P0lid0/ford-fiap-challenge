-- Seed mínimo de concessionárias para os testes funcionarem.
insert into public.dealerships (codigo, nome, regiao, cidade, uf) values
  ('FD001', 'Ford Premier Paulista',     'sudeste',      'São Paulo',       'SP'),
  ('FD002', 'Ford Vias do Sul',           'sul',          'Porto Alegre',    'RS'),
  ('FD003', 'Ford BH Center',             'sudeste',      'Belo Horizonte',  'MG'),
  ('FD004', 'Ford Capital Recife',        'nordeste',     'Recife',          'PE'),
  ('FD005', 'Ford Manaus Norte',          'norte',        'Manaus',          'AM'),
  ('FD006', 'Ford Brasília Asa Sul',      'centro_oeste', 'Brasília',        'DF'),
  ('FD007', 'Ford Curitiba ABC',          'sul',          'Curitiba',        'PR'),
  ('FD008', 'Ford Salvador Pituba',       'nordeste',     'Salvador',        'BA'),
  ('FD009', 'Ford Goiânia Marista',       'centro_oeste', 'Goiânia',         'GO'),
  ('FD010', 'Ford Rio Barra',             'sudeste',      'Rio de Janeiro',  'RJ')
on conflict (codigo) do nothing;
