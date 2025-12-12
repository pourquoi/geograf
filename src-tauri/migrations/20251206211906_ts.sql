ALTER TABLE flow ADD COLUMN created_at TEXT;
ALTER TABLE flow ADD COLUMN updated_at TEXT;

UPDATE flow SET created_at = CURRENT_TIMESTAMP;
UPDATE flow SET updated_at = CURRENT_TIMESTAMP;

CREATE TABLE flow_new (
    id VARCHAR(35) NOT NULL,
    name TEXT NOT NULL,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO flow_new (id, name, nodes, edges, created_at, updated_at)
SELECT id, name, nodes, edges, created_at, updated_at FROM flow;

DROP TABLE flow;

ALTER TABLE flow_new RENAME TO flow;
