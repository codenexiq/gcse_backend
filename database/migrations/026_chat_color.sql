-- The colour a person chose for the chat area (like #dff3e6). Empty = the standard colour.
ALTER TABLE users ADD COLUMN chat_color VARCHAR(7) NULL;
