import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Donaproto } from "../target/types/donaproto";

describe("donaproto", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Donaproto as Program<Donaproto>;

  it("Is initialized!", async () => {
    // Add your test here.
    console.log("Your transaction signature");
  });
});
