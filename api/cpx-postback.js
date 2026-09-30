const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Combien de K le membre reçoit pour 1 USD gagné chez CPX.
// Exemple : 0.5 => un sondage payé 0.40 USD par CPX crédite 0.20 K au membre.
const CONVERSION_RATE_USD_TO_K = 0.5;

module.exports = async (req, res) => {
  try {
    const { status, trans_id, user_id, amount_usd, hash } = req.query;

    if (!status || !trans_id || !user_id || !hash) {
      res.status(400).send("missing_params");
      return;
    }

    const secret = process.env.CPX_SECURE_HASH;
    const expectedHash = crypto.createHash("md5").update(trans_id + "-" + secret).digest("hex");

    if (hash !== expectedHash) {
      res.status(403).send("invalid_hash");
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const rewardK = Number((parseFloat(amount_usd || "0") * CONVERSION_RATE_USD_TO_K).toFixed(4));

    const { data: existing } = await supabase
      .from("cpx_transactions")
      .select("trans_id, statut, reward_k")
      .eq("trans_id", trans_id)
      .maybeSingle();

    if (status === "1") {
      if (!existing) {
        const { data: profile } = await supabase.from("profiles").select("solde").eq("id", user_id).single();
        const soldeActuel = (profile && typeof profile.solde === "number") ? profile.solde : 0;
        await supabase.from("profiles").update({ solde: soldeActuel + rewardK }).eq("id", user_id);
        await supabase.from("cpx_transactions").insert({
          trans_id, user_id, amount_usd: parseFloat(amount_usd || "0"), reward_k: rewardK, statut: "confirme"
        });
      }
    } else if (status === "2") {
      if (existing && existing.statut === "confirme") {
        const { data: profile } = await supabase.from("profiles").select("solde").eq("id", user_id).single();
        const soldeActuel = (profile && typeof profile.solde === "number") ? profile.solde : 0;
        await supabase.from("profiles").update({ solde: Math.max(0, soldeActuel - existing.reward_k) }).eq("id", user_id);
        await supabase.from("cpx_transactions").update({ statut: "annule" }).eq("trans_id", trans_id);
      }
    }

    res.status(200).send("1");
  } catch (e) {
    res.status(500).send("error");
  }
};
