-- Tables in our postgres database
CREATE TABLE pin_code(
    device_id TEXT NOT NULL PRIMARY KEY,
    encryption_key TEXT NOT NULL,
    pin INTEGER NOT NULL,
    incorrect_attempts INTEGER NOT NULL DEFAULT 0
);