//! Re-execute the pinned original native engine before admitting a Myelin match frame.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
pub const ID: &str = "myelin-openstrike";
pub const MAX_ACTIONS: u64 = 1;
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Game {
    result: Option<Value>,
    tape_hash: Option<String>,
    room: Option<String>,
    players: Vec<String>,
}
fn hash(b: &[u8]) -> String {
    blake3::hash(b).to_hex().to_string()
}
// JavaScript serializes 0.0 as 0. Normalize representation, without rounding or
// tolerance: every result number is a bounded engine coordinate/counter, never u128 identity.
fn numeric_json(v: &Value) -> Value {
    match v {
        Value::Number(n) => json!(n.as_f64().unwrap()),
        Value::Array(a) => Value::Array(a.iter().map(numeric_json).collect()),
        Value::Object(o) => Value::Object(
            o.iter()
                .map(|(k, v)| (k.clone(), numeric_json(v)))
                .collect(),
        ),
        _ => v.clone(),
    }
}
impl Game {
    pub fn apply(&mut self, action: &Value) -> Result<(), String> {
        if self.result.is_some() || action["type"] != "match" {
            return Err("Expected a complete match".into());
        }
        let tape = action["tape"].as_str().ok_or("Missing input tape")?;
        if tape.is_empty() || tape.len() > 4_000_000 || tape.lines().count() > 5760 {
            return Err("Invalid tape length".into());
        }
        let room = action["room"].as_str().ok_or("Missing room")?;
        if room.len() != 24 || !room.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("Invalid room".into());
        }
        let players: Vec<String> =
            serde_json::from_value(action["players"].clone()).map_err(|e| e.to_string())?;
        if players.len() != 2
            || players.iter().any(|p| {
                p != "practice-bot" && (p.len() != 64 || !p.bytes().all(|b| b.is_ascii_hexdigit()))
            })
        {
            return Err("Invalid players".into());
        }
        let bin = std::path::PathBuf::from(
            std::env::var("OPENSTRIKE_ASSETS").unwrap_or_else(|_| "release".into()),
        )
        .join("myelin-arena-bridge");
        if hash(&fs::read(&bin).map_err(|e| e.to_string())?)
            != hash(include_bytes!("../../release/myelin-arena-bridge"))
        {
            return Err("Native engine digest mismatch".into());
        }
        let mut file = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
        file.write_all(tape.as_bytes()).map_err(|e| e.to_string())?;
        let out = tempfile::NamedTempFile::new().map_err(|e| e.to_string())?;
        let mut child = Command::new(bin)
            .arg("replay")
            .arg(file.path())
            .stdin(Stdio::null())
            .stdout(out.reopen().map_err(|e| e.to_string())?)
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        let start = Instant::now();
        loop {
            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                if !status.success() {
                    return Err("Native replay rejected".into());
                }
                break;
            }
            if start.elapsed() > Duration::from_secs(15) {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Replay timed out".into());
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        let replay: Value =
            serde_json::from_slice(&fs::read(out.path()).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if numeric_json(&replay) != numeric_json(&action["result"]) || replay["completed"] != true {
            return Err("Live result differs from complete native replay".into());
        }
        self.result = Some(replay);
        self.tape_hash = Some(hash(tape.as_bytes()));
        self.room = Some(room.into());
        self.players = players;
        Ok(())
    }
    pub fn view(&self) -> Value {
        json!({"result":self.result,"tape_hash":self.tape_hash,"room":self.room,"players":self.players})
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.result.is_some()
            && (self.tape_hash.as_ref().map(String::len) != Some(64) || self.players.len() != 2)
        {
            return Err("Invalid match snapshot".into());
        }
        Ok(())
    }
}
