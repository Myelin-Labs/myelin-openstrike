//! Browser/Myelin boundary for the original OpenStrikeDuelSim. No alternate game rules.
use anyhow::{Result, bail};
use openstrike_fiber_arena::{
    devmap,
    openstrike::OpenStrikeDuelSim,
    protocol::{InputFrame, MatchPhase},
    sim::MatchSimulation,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    fs,
    io::{self, BufRead, Write},
};
const MAX_TICKS: usize = 64 * 90;
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Step {
    inputs: [InputFrame; 2],
}
fn execute(
    sim: &mut OpenStrikeDuelSim,
    tick: usize,
    step: &Step,
    chain: &mut blake3::Hasher,
) -> Value {
    let events = sim.tick(step.inputs);
    let state = sim.world_snapshot(0, tick as u64, 0);
    let frame = json!({"tick":tick,"state":state,"events":events,"native_state_hash":hex::encode(sim.state_hash())});
    chain.update(&serde_json::to_vec(&frame).unwrap());
    frame
}
fn main() -> Result<()> {
    let args: Vec<_> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("map") {
        println!(
            "{}",
            json!({"floor":devmap::FLOOR_Y,"extent":devmap::EXTENT,"wall_height":devmap::WALL_HEIGHT,"move_clamp":devmap::MOVE_CLAMP,"player_half":devmap::PLAYER_HALF_XZ,"spawns":devmap::spawns().map(|s|json!({"position":s.pos.to_array(),"yaw":s.yaw})),"obstacles":devmap::obstacles().iter().map(|o|json!({"min":o.min.to_array(),"max":o.max.to_array(),"kind":format!("{:?}",o.kind)})).collect::<Vec<_>>()})
        );
        return Ok(());
    }
    let replay = args.get(1).map(String::as_str) == Some("replay");
    let mut sim = OpenStrikeDuelSim::dev_arena();
    sim.set_phase(MatchPhase::Live);
    let mut chain = blake3::Hasher::new();
    let mut last = Value::Null;
    let mut tick = 0;
    let reader: Box<dyn BufRead> = if replay {
        let file = args.get(2).ok_or_else(|| anyhow::anyhow!("missing tape"))?;
        if fs::metadata(file)?.len() > 4_000_000 {
            bail!("Tape exceeds limit")
        };
        Box::new(io::BufReader::new(fs::File::open(file)?))
    } else {
        Box::new(io::BufReader::new(io::stdin()))
    };
    let mut out = io::BufWriter::new(io::stdout());
    for line in reader.lines() {
        let line = line?;
        if line.len() > 2048 {
            bail!("Frame exceeds limit")
        };
        let step: Step = serde_json::from_str(&line)?;
        if sim.phase() != MatchPhase::Live {
            bail!("Input after round ended")
        };
        tick += 1;
        if tick > MAX_TICKS {
            bail!("Round exceeds 90 seconds")
        };
        for input in step.inputs {
            if !input.move_x.is_finite()
                || !input.move_y.is_finite()
                || !input.yaw.is_finite()
                || !input.pitch.is_finite()
                || input.move_x.abs() > 1.0
                || input.move_y.abs() > 1.0
                || input.yaw.abs() > 10_000.0
                || input.pitch.abs() > 1.554
            {
                bail!("Invalid input")
            }
        }
        last = execute(&mut sim, tick, &step, &mut chain);
        if !replay {
            writeln!(out, "{}", json!({"type":"frame","frame":last}))?;
            out.flush()?;
        }
    }
    if tick == 0 {
        bail!("Empty tape")
    }
    // A timeout is explicitly distinct from a native kill; no fabricated winner.
    let result = json!({"ticks":tick,"last":last,"trace_hash":chain.finalize().to_hex().to_string(),"completed":sim.phase()!=MatchPhase::Live||tick==MAX_TICKS});
    if replay {
        writeln!(out, "{result}")?;
    } else {
        writeln!(out, "{}", json!({"type":"result","result":result}))?;
    }
    out.flush()?;
    Ok(())
}
