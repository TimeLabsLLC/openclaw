/**
 * AlignmentConsole
 * Perplexity-inspired interactive pre-flight plan alignment console.
 * Decomposes goals into sequential steps and prompts for necessary constraints.
 */
export class AlignmentConsole {
  constructor(app) {
    this.app = app;
    this.panel = null;
    this.activeResolve = null;
    this.activeReject = null;
  }

  /**
   * Present an interactive alignment plan with custom clarifying questions.
   * Returns a promise resolving with the user's questionnaire replies upon approval.
   */
  proposePlan(plan, questions = []) {
    return new Promise((resolve, reject) => {
      this.activeResolve = resolve;
      this.activeReject = reject;

      this.app.setViewMode("full"); // Ensure we are in full view to interact
      this.app.orb.setState("aligning");

      this.render(plan, questions);
    });
  }

  render(plan, questions) {
    // Clean up any existing panel
    this.close();

    this.panel = document.createElement("div");
    this.panel.id = "alignment-console";
    this.panel.className = "alignment-console-hidden glass-panel";

    const header = document.createElement("div");
    header.className = "alignment-header";
    header.innerHTML = `
      <div class="alignment-title-wrapper">
        <span class="alignment-icon">⚛️</span>
        <h3>Alignment Vector: Pre-Flight Configuration</h3>
      </div>
      <p class="alignment-subtitle">Core requires validation of intent and parameters before proceeding.</p>
    `;

    const body = document.createElement("div");
    body.className = "alignment-body";

    // Renders the structured multi-step plan
    const planSection = document.createElement("div");
    planSection.className = "alignment-section alignment-plan-section";
    planSection.innerHTML = "<h4>Proposed Execution Sequence</h4>";

    const planList = document.createElement("ol");
    planList.className = "alignment-plan-steps";
    plan.forEach((step) => {
      const li = document.createElement("li");
      li.innerText = step;
      planList.appendChild(li);
    });
    planSection.appendChild(planList);
    body.appendChild(planSection);

    // Renders custom clarifying questions
    if (questions.length > 0) {
      const qSection = document.createElement("div");
      qSection.className = "alignment-section alignment-questions-section";
      qSection.innerHTML = "<h4>System Constraints Required</h4>";

      const qForm = document.createElement("form");
      qForm.id = "alignment-form";

      questions.forEach((q, index) => {
        const formGroup = document.createElement("div");
        formGroup.className = "form-group";

        const label = document.createElement("label");
        label.setAttribute("for", `q-${index}`);
        label.innerText = q.text;
        formGroup.appendChild(label);

        if (q.choices && q.choices.length > 0) {
          const select = document.createElement("select");
          select.id = `q-${index}`;
          select.className = "form-select";
          q.choices.forEach((choice) => {
            const opt = document.createElement("option");
            opt.value = choice;
            opt.innerText = choice;
            select.appendChild(opt);
          });
          formGroup.appendChild(select);
        } else {
          const input = document.createElement("input");
          input.type = "text";
          input.id = `q-${index}`;
          input.className = "form-input";
          input.placeholder = q.placeholder || "Specify value...";
          input.required = q.required !== false;
          formGroup.appendChild(input);
        }
        qForm.appendChild(formGroup);
      });
      qSection.appendChild(qForm);
      body.appendChild(qSection);
    }

    // Interactive Action Controls
    const footer = document.createElement("div");
    footer.className = "alignment-footer";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn-secondary";
    btnCancel.innerText = "Abort Mission";
    btnCancel.addEventListener("click", (e) => {
      e.preventDefault();
      this.activeReject(new Error("Plan aborted by user"));
      this.close();
    });

    const btnApprove = document.createElement("button");
    btnApprove.className = "btn-primary btn-glow";
    btnApprove.innerText = "Approve & Deploy";
    btnApprove.addEventListener("click", (e) => {
      e.preventDefault();
      const replies = [];
      questions.forEach((q, index) => {
        const el = document.getElementById(`q-${index}`);
        replies.push({
          question: q.text,
          answer: el ? el.value : "",
        });
      });
      this.activeResolve(replies);
      this.close();
    });

    footer.appendChild(btnCancel);
    footer.appendChild(btnApprove);

    this.panel.appendChild(header);
    this.panel.appendChild(body);
    this.panel.appendChild(footer);

    const mainContent = document.getElementById("content");
    if (mainContent) {
      mainContent.appendChild(this.panel);
      // Fade-in trigger
      setTimeout(() => {
        this.panel.className = "alignment-console-visible glass-panel";
      }, 50);
    }
  }

  close() {
    if (this.panel) {
      this.panel.className = "alignment-console-hidden glass-panel";
      const p = this.panel;
      setTimeout(() => {
        if (p.parentNode) {
          p.parentNode.removeChild(p);
        }
      }, 300);
      this.panel = null;
      this.app.orb.setState("idle");
    }
  }
}
