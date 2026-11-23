CREATE TABLE categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE,
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_categorias_nome ON categorias(nome);

CREATE TABLE setores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE,
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_setores_nome ON setores(nome);

CREATE TABLE equipamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tombamento TEXT NOT NULL COLLATE NOCASE,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
  setor_id INTEGER NOT NULL REFERENCES setores(id) ON DELETE RESTRICT,
  complemento_local TEXT,
  marca TEXT,
  modelo TEXT,
  numero_serie TEXT,
  status TEXT NOT NULL CHECK (status IN ('em_uso','em_estoque','em_manutencao','baixado')),
  data_aquisicao TEXT,
  valor_aquisicao_centavos INTEGER CHECK (valor_aquisicao_centavos IS NULL OR valor_aquisicao_centavos >= 0),
  fornecedor TEXT,
  nota_fiscal TEXT,
  garantia_ate TEXT,
  observacoes TEXT,
  motivo_baixa TEXT,
  data_baixa TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'baixado' AND data_baixa IS NOT NULL AND motivo_baixa IS NOT NULL AND length(trim(motivo_baixa)) >= 3)
    OR (status <> 'baixado' AND data_baixa IS NULL AND motivo_baixa IS NULL)
  )
);
CREATE UNIQUE INDEX idx_equipamentos_tombamento ON equipamentos(tombamento);
CREATE UNIQUE INDEX idx_equipamentos_serie ON equipamentos(numero_serie)
  WHERE numero_serie IS NOT NULL AND length(trim(numero_serie)) > 0;

CREATE TABLE movimentacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipamento_id INTEGER NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  setor_origem_id INTEGER REFERENCES setores(id) ON DELETE RESTRICT,
  setor_destino_id INTEGER NOT NULL REFERENCES setores(id) ON DELETE RESTRICT,
  complemento_origem TEXT,
  complemento_destino TEXT,
  motivo TEXT NOT NULL,
  data_movimentacao TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_movimentacoes_equipamento ON movimentacoes(equipamento_id, data_movimentacao DESC, id DESC);

CREATE TABLE manutencoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipamento_id INTEGER NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('preventiva','corretiva')),
  situacao TEXT NOT NULL CHECK (situacao IN ('aberta','concluida','cancelada')),
  data_abertura TEXT NOT NULL,
  data_conclusao TEXT,
  descricao_problema TEXT NOT NULL,
  solucao TEXT,
  custo_centavos INTEGER CHECK (custo_centavos IS NULL OR custo_centavos >= 0),
  fornecedor_assistencia TEXT,
  motivo_cancelamento TEXT,
  status_anterior TEXT NOT NULL CHECK (status_anterior IN ('em_uso','em_estoque','em_manutencao','baixado')),
  status_equipamento_apos TEXT CHECK (status_equipamento_apos IS NULL OR status_equipamento_apos IN ('em_uso','em_estoque','baixado')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (situacao = 'aberta' AND data_conclusao IS NULL AND solucao IS NULL AND motivo_cancelamento IS NULL AND status_equipamento_apos IS NULL)
    OR (situacao = 'concluida' AND data_conclusao IS NOT NULL AND solucao IS NOT NULL AND length(trim(solucao)) >= 3 AND motivo_cancelamento IS NULL AND status_equipamento_apos IS NOT NULL)
    OR (situacao = 'cancelada' AND motivo_cancelamento IS NOT NULL AND length(trim(motivo_cancelamento)) >= 3 AND status_equipamento_apos IS NULL)
  )
);
CREATE UNIQUE INDEX idx_manutencao_uma_aberta ON manutencoes(equipamento_id) WHERE situacao = 'aberta';
CREATE INDEX idx_manutencoes_equipamento ON manutencoes(equipamento_id, data_abertura DESC, id DESC);

INSERT INTO categorias (nome, descricao, ativo, created_at, updated_at) VALUES
  ('Computador', 'Desktop de mesa', 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Notebook', NULL, 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Monitor', NULL, 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Roteador', NULL, 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Switch', NULL, 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Impressora', NULL, 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Nobreak', NULL, 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Periférico', 'Teclado, mouse, webcam, headset e similares', 1, datetime('now','localtime'), datetime('now','localtime')),
  ('Outro', 'Demais equipamentos de informática', 1, datetime('now','localtime'), datetime('now','localtime'));
