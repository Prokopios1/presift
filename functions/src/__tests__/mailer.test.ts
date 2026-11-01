import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildInvite, buildTransport, senderAddress, dailyCap } from "../mailer";

const URL_ = "https://presift.web.app/assessment/cand_abc123";

describe("buildInvite", () => {
  it("builds a Greek invitation by default", () => {
    const m = buildInvite({
      to: "x@example.com",
      candidateName: "Αθανάσιος Παπαδόπουλος",
      roleTitle: "Sales Manager",
      company: "Broadnet",
      url: URL_,
    });
    expect(m.lang).toBe("el");
    expect(m.subject).toContain("Sales Manager");
    expect(m.text).toContain("Αθανάσιος Παπαδόπουλος");
    expect(m.text).toContain("Broadnet");
    expect(m.text).toContain(URL_);
    expect(m.html).toContain(URL_);
    expect(m.html).toContain('lang="el"');
  });

  it("builds an English invitation when lang=en", () => {
    const m = buildInvite({
      to: "x@example.com",
      roleTitle: "Sales Manager",
      company: "Broadnet",
      url: URL_,
      lang: "en",
    });
    expect(m.lang).toBe("en");
    expect(m.text).toContain("Dear candidate");
    expect(m.text).toContain("Broadnet");
    expect(m.html).toContain('lang="en"');
  });

  it("escapes HTML in the role and company", () => {
    const m = buildInvite({
      to: "x@example.com",
      roleTitle: "<b>Ops</b>",
      company: "A & B",
      url: URL_,
      lang: "en",
    });
    expect(m.html).toContain("&lt;b&gt;Ops&lt;/b&gt;");
    expect(m.html).toContain("A &amp; B");
    expect(m.html).not.toContain("<b>Ops</b>");
  });

  it("falls back to a neutral greeting without a name", () => {
    const el = buildInvite({ to: "x@example.com", roleTitle: "Ops", company: "C", url: URL_ });
    expect(el.text).toContain("Αγαπητέ/ή υποψήφιε");
    const en = buildInvite({ to: "x@example.com", roleTitle: "Ops", company: "C", url: URL_, lang: "en" });
    expect(en.text).toContain("Dear candidate");
  });
});

describe("transport configuration", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.PILOT_DAILY_CAP;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it("throws instead of falling back to a mock credential", () => {
    expect(() => buildTransport()).toThrow(/SMTP not configured/);
  });

  it("throws when the sender address is missing", () => {
    expect(() => senderAddress()).toThrow(/SMTP_FROM/);
  });

  it("reads the pilot cap and treats it as disabled when unset or zero", () => {
    expect(dailyCap()).toBe(0);
    process.env.PILOT_DAILY_CAP = "30";
    expect(dailyCap()).toBe(30);
    process.env.PILOT_DAILY_CAP = "0";
    expect(dailyCap()).toBe(0);
  });
});
