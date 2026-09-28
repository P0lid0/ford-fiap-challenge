#!/usr/bin/env python3
"""Generate the FaroAI Testing, Compliance and QA plan and Azure Boards CSV."""

import csv
import html
import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs/deliverables/testing_qa_backlog.json"
PLAN = ROOT / "docs/deliverables/Plano_Testing_Compliance_QA_FaroAI.md"
IMPORT = ROOT / "docs/deliverables/Backlog_FaroAI_Azure_Boards.csv"


def load_data():
    return json.loads(DATA.read_text(encoding="utf-8"))


def walk_items(data):
    for epic in data["epics"]:
        for feature in epic["features"]:
            for item in feature["items"]:
                yield epic, feature, item


def escape(value):
    return html.escape(str(value), quote=False)


def html_description(item):
    if item["type"] in {"Epic", "Feature"}:
        done = "".join(f"<li>{escape(entry)}</li>" for entry in item["done"])
        return (
            f"<p>{escape(item['description'])}</p>"
            + html_acceptance(item["acceptance"])
            + "<p><strong>Critérios de pronto</strong></p><ul>"
            + done
            + "</ul>"
        )
    parts = [
        f"<p><strong>Como:</strong> {escape(item['persona'])}</p>",
        f"<p><strong>Quero:</strong> {escape(item['need'])}</p>",
        f"<p><strong>Para:</strong> {escape(item['why'])}</p>",
        f"<p><strong>Arquitetura:</strong> {escape(item['architecture'])}</p>",
        f"<p><strong>Sprint proposta:</strong> {escape(item['sprint'])}</p>",
    ]
    if item.get("depends_on"):
        parts.append(
            "<p><strong>Predecessores:</strong> "
            + escape(", ".join(item["depends_on"]))
            + "</p>"
        )
    return "".join(parts)


def html_acceptance(criteria):
    if not criteria:
        return ""
    scenarios = []
    for scenario in criteria:
        scenarios.append(
            "<li><strong>Dado que</strong> "
            + escape(scenario["given"])
            + ", <strong>quando</strong> "
            + escape(scenario["when"])
            + ", <strong>então</strong> "
            + escape(scenario["then"])
            + ".</li>"
        )
    return "<ol>" + "".join(scenarios) + "</ol>"


def append_acceptance(lines, criteria):
    lines.extend(["**Critérios de aceite**", ""])
    for index, scenario in enumerate(criteria, start=1):
        lines.append(
            f"{index}. Dado que {scenario['given']}, quando "
            f"{scenario['when']}, então {scenario['then']}."
        )
    lines.append("")


def append_done(lines, criteria):
    lines.extend(["**Critérios de pronto**", ""])
    lines.extend(f"- {criterion}" for criterion in criteria)
    lines.append("")


def point_totals(data):
    totals = defaultdict(int)
    for _, _, item in walk_items(data):
        totals[item["sprint"]] += item["effort"]
    return dict(totals)


def validate_data(data):
    items = list(walk_items(data))
    item_by_id = {item["id"]: item for _, _, item in items}
    tasks = {task["id"]: task for task in data["sprint3_tasks"]}
    all_ids = set(item_by_id) | set(tasks)
    for epic in data["epics"]:
        if not epic.get("description") or not epic.get("acceptance") or not epic.get("done"):
            raise ValueError(f"Epic sem descrição, aceite ou pronto: {epic['id']}")
        for feature in epic["features"]:
            if not feature.get("description") or not feature.get("acceptance") or not feature.get("done"):
                raise ValueError(f"Feature sem descrição, aceite ou pronto: {feature['id']}")
    for _, _, item in items:
        if not item.get("acceptance") or not item.get("done"):
            raise ValueError(f"PBI sem aceite ou pronto: {item['id']}")
    if len(item_by_id) != len(items):
        raise ValueError("Há IDs de PBI duplicados.")
    if len(tasks) != len(data["sprint3_tasks"]):
        raise ValueError("Há IDs de tarefa duplicados.")
    sprint_names = {sprint["name"] for sprint in data["sprints"]}
    for _, _, item in items:
        if item["sprint"] not in sprint_names:
            raise ValueError(f"Sprint inválida em {item['id']}.")
        for predecessor in item["depends_on"]:
            if predecessor not in all_ids:
                raise ValueError(f"Dependência inexistente em {item['id']}: {predecessor}")
    for task in data["sprint3_tasks"]:
        if task["parent"] not in item_by_id:
            raise ValueError(f"Pai inexistente em {task['id']}: {task['parent']}")
        for predecessor in task["depends_on"]:
            if predecessor not in all_ids:
                raise ValueError(f"Dependência inexistente em {task['id']}: {predecessor}")
    sprint3_pbi_points = sum(
        item["effort"] for _, _, item in items if item["sprint"] == "Sprint 3"
    )
    sprint3_task_points = sum(task["effort"] for task in data["sprint3_tasks"])
    if sprint3_pbi_points != sprint3_task_points:
        raise ValueError(
            "As tarefas da Sprint 3 devem somar os pontos dos PBIs da Sprint: "
            f"{sprint3_task_points} != {sprint3_pbi_points}."
        )


def write_import_csv(data):
    fields = [
        "Work Item Type",
        "Title 1",
        "Title 2",
        "Title 3",
        "Title 4",
        "Description",
        "Acceptance Criteria",
        "Priority",
        "Effort",
        "Tags",
    ]
    tasks_by_parent = defaultdict(list)
    for task in data["sprint3_tasks"]:
        tasks_by_parent[task["parent"]].append(task)
    rows = []
    for epic in data["epics"]:
        rows.append(
            {
                "Work Item Type": "Epic",
                "Title 1": epic["title"],
                "Description": html_description({"type": "Epic", **epic}),
                "Tags": "FaroAI;Epic",
            }
        )
        for feature in epic["features"]:
            rows.append(
                {
                    "Work Item Type": "Feature",
                    "Title 2": feature["title"],
                    "Description": html_description({"type": "Feature", **feature}),
                    "Tags": "FaroAI;Feature",
                }
            )
            for item in feature["items"]:
                rows.append(
                    {
                        "Work Item Type": "Product Backlog Item",
                        "Title 3": item["title"],
                        "Description": html_description(
                            {"type": "Product Backlog Item", **item}
                        ),
                        "Acceptance Criteria": html_acceptance(item["acceptance"]),
                        "Priority": item["azure_priority"],
                        "Effort": item["effort"],
                        "Tags": f"FaroAI;{item['sprint']};{item['priority']}",
                    }
                )
                for task in tasks_by_parent[item["id"]]:
                    dependencies = ", ".join(task["depends_on"]) or "Nenhuma"
                    description = (
                        f"<p>{escape(task['description'])}</p>"
                        f"<p><strong>Estimativa Planning Poker:</strong> "
                        f"{task['effort']} SP.</p>"
                        f"<p><strong>Dependências:</strong> {escape(dependencies)}.</p>"
                        f"<p><strong>Saída:</strong> {escape(task['output'])}</p>"
                    )
                    rows.append(
                        {
                            "Work Item Type": "Task",
                            "Title 4": task["title"],
                            "Description": description,
                            "Tags": f"FaroAI;Sprint 3;Task;{task['id']}",
                        }
                    )
    with IMPORT.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=fields,
            extrasaction="ignore",
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)
    with IMPORT.open(encoding="utf-8-sig", newline="") as source:
        imported = list(csv.DictReader(source))
    if len(imported) != len(rows) or any(not row["Work Item Type"] for row in imported):
        raise ValueError("O CSV gerado não passou pela verificação de leitura.")
    hierarchy_columns = ["Title 1", "Title 2", "Title 3", "Title 4"]
    expected_types = ["Epic", "Feature", "Product Backlog Item", "Task"]
    current_path = {}
    for row in imported:
        populated = [column for column in hierarchy_columns if row[column]]
        if len(populated) != 1:
            raise ValueError("Cada linha CSV deve conter um único título hierárquico.")
        depth = hierarchy_columns.index(populated[0]) + 1
        if row["Work Item Type"] != expected_types[depth - 1]:
            raise ValueError(f"Tipo e nível hierárquico incompatíveis: {row}")
        if depth > 1 and depth - 1 not in current_path:
            raise ValueError(f"Item sem pai no CSV: {row[populated[0]]}")
        current_path = {level: title for level, title in current_path.items() if level < depth}
        current_path[depth] = row[populated[0]]
    return imported


def render_plan(data):
    totals = point_totals(data)
    project = data["project"]
    lines = [
        f"# Plano de Testing, Compliance e Quality Assurance — {project['name']}",
        "",
        f"**Projeto:** {project['course']} · **Equipe:** {project['team']} · **Data-base:** {project['date']}",
        "",
        project["purpose"],
        "",
        "## Escopo e premissas",
        "",
    ]
    lines.extend(f"- {assumption}" for assumption in data["assumptions"])
    lines += [
        "",
        "O PDF atribui 20% a cada parte da atividade: hierarquia Scrum; descrições, aceite e pronto em BDD; prioridade, Planning Poker e dependências; release plan; e tarefas da Sprint atual.",
        "",
        "## Alinhamento com a arquitetura",
        "",
        "| Épico | Fluxos e componentes relacionados |",
        "|---|---|",
    ]
    for epic in data["epics"]:
        lines.append(f"| {epic['title']} | {epic['architecture']} |")
    lines += [
        "",
        "O projeto usa o modelo FaroAI em FaroAI_Architecture.archimate. O arquivo de Help Desk fornecido na pasta de aula é um exemplo didático diferente.",
        "",
        "## Prioridade e esforço",
        "",
        "A prioridade descreve a necessidade para o negócio e para a entrega. O número é o valor inicial para o campo Priority do Azure Boards.",
        "",
        "| Rótulo | Priority | Regra de priorização |",
        "|---|---:|---|",
    ]
    for priority in data["priority_scale"]:
        lines.append(
            f"| {priority['label']} | {priority['azure_priority']} | {priority['meaning']} |"
        )
    lines += [
        "",
        "Os PBIs usam pontos Planning Poker na escala Fibonacci. Os pontos são uma proposta baseada no código e na arquitetura; a equipe deve reestimar em conjunto. Não converta pontos diretamente em horas.",
        "",
        "Prioridade e esforço são registrados nos PBIs. Epics e Features recebem prioridade pela urgência de seus filhos e não recebem pontos separados, para evitar contagem dupla.",
        "",
        "## Definition of Ready",
        "",
    ]
    lines.extend(f"- {item}" for item in data["definition_of_ready"])
    lines += ["", "## Definition of Done", ""]
    lines.extend(f"- {item}" for item in data["definition_of_done"])
    lines += ["", "## Release plan", ""]
    lines += [
        "| Sprint | Meta | Data indicada no PDF | Pontos | Escopo planejado |",
        "|---|---|---|---:|---|",
    ]
    for sprint in data["sprints"]:
        sprint_items = [
            item["id"]
            for _, _, item in walk_items(data)
            if item["sprint"] == sprint["name"]
        ]
        lines.append(
            f"| {sprint['name']} | {sprint['goal']} | {sprint['end_date']} | "
            f"{totals.get(sprint['name'], 0)} | {', '.join(sprint_items)} |"
        )
    lines += [
        "",
        "A carga proposta varia de 29 a 34 pontos por Sprint. Esse equilíbrio é apenas inicial. Confirmar a velocidade real e ajustar o plano com a equipe. As datas das Sprints 1 e 2 não aparecem no PDF.",
        "",
        "## Backlog de produto",
        "",
        "Cada PBI usa o formato Como/Quero/Para. Os cenários de aceite seguem Dado/Quando/Então. As relações pai/filho entram no CSV; os predecessores técnicos ficam listados para criação como links Predecessor no Azure Boards.",
        "",
    ]
    for epic in data["epics"]:
        lines += [
            f"### {epic['id']} · {epic['title']}",
            "",
            epic["description"],
            "",
            f"**Rastreabilidade:** {epic['architecture']}",
            "",
        ]
        append_acceptance(lines, epic["acceptance"])
        append_done(lines, epic["done"])
        for feature in epic["features"]:
            lines += [
                f"#### {feature['id']} · {feature['title']}",
                "",
                feature["description"],
                "",
            ]
            append_acceptance(lines, feature["acceptance"])
            append_done(lines, feature["done"])
            for item in feature["items"]:
                lines += [
                    f"##### {item['id']} · {item['title']}",
                    "",
                    f"**Prioridade:** {item['priority']} (Azure Priority {item['azure_priority']}) · "
                    f"**Esforço:** {item['effort']} SP · **Sprint:** {item['sprint']}",
                    "",
                    f"**Como:** {item['persona']}.",
                    "",
                    f"**Quero:** {item['need']}.",
                    "",
                    f"**Para:** {item['why']}.",
                    "",
                    f"**Arquitetura relacionada:** {item['architecture']}",
                    "",
                    "**Critérios de aceite**",
                    "",
                ]
                for index, scenario in enumerate(item["acceptance"], start=1):
                    lines.append(
                        f"{index}. Dado que {scenario['given']}, quando "
                        f"{scenario['when']}, então {scenario['then']}."
                    )
                dependencies = ", ".join(item["depends_on"]) or "Nenhum predecessor técnico."
                lines += [
                    "",
                    f"**Predecessores técnicos:** {dependencies}",
                    "",
                    "**Critério de pronto para este item**",
                    "",
                ]
                lines.extend(f"- {criterion}" for criterion in item["done"])
                lines.append("")
    task_points = sum(task["effort"] for task in data["sprint3_tasks"])
    current_goal = next(
        sprint["goal"]
        for sprint in data["sprints"]
        if sprint["name"] == project["current_sprint"]
    )
    lines += [
        "## Detalhamento da Sprint atual",
        "",
        f"**Sprint:** {project['current_sprint']} · **Meta:** {current_goal} · **Total:** {task_points} SP.",
        "",
        "As estimativas das tarefas também são pontos Planning Poker para atender à rubrica. No processo Scrum do Azure Boards, Task costuma ser estimada em horas. Guarde os pontos na descrição ou crie um campo de pontos se a organização já tiver esse padrão.",
        "",
        "| ID | PBI pai | Tarefa | Descrição | SP | Dependências técnicas | Saída verificável |",
        "|---|---|---|---|---:|---|---|",
    ]
    for task in data["sprint3_tasks"]:
        dependencies = ", ".join(task["depends_on"]) or "Nenhuma"
        lines.append(
            f"| {task['id']} | {task['parent']} | {task['title']} | "
            f"{task['description']} | {task['effort']} | {dependencies} | {task['output']} |"
        )
    lines += [
        "",
        "### Dependências entre PBIs",
        "",
        "| PBI | Predecessores que devem ser ligados no Azure Boards |",
        "|---|---|",
    ]
    for _, _, item in walk_items(data):
        if item["depends_on"]:
            lines.append(f"| {item['id']} | {', '.join(item['depends_on'])} |")
    lines += [
        "",
        "## Publicação no Azure DevOps",
        "",
        "O ambiente não tem uma conexão Azure Boards disponível. O projeto, os work items e o convite do professor ainda não foram publicados. Use o CSV para importar a hierarquia depois de selecionar ou criar a organização e o projeto.",
        "",
        "1. Crie ou selecione um projeto Azure DevOps com o processo Scrum.",
        "2. Abra Boards > Queries > Import work items e selecione Backlog_FaroAI_Azure_Boards.csv.",
        "3. Confira o preview, corrija campos incompatíveis e salve os itens.",
        "4. Configure Area Path e Iteration Path com os nomes reais da organização.",
        "5. Adicione os links Predecessor indicados neste plano. O CSV cria a hierarquia pai/filho, mas não importa os demais tipos de link.",
        "6. Confirme os pontos por Planning Poker e revise o balanceamento das Sprints.",
        "7. Adicione o professor à organização com acesso Basic e ao projeto como Project Administrator.",
        "8. Teste o link do projeto e anexe o link e a evidência de permissão à entrega.",
        "",
        "Os arquivos consultados não identificam a organização nem o e-mail institucional do professor. A pessoa responsável pela organização precisa inserir a conta correta. Não registre credenciais ou tokens no repositório.",
        "",
        "O importador CSV do Azure Boards cria hierarquias por títulos indentados. Os campos e tipos disponíveis variam conforme o processo e a organização. Confira o preview antes de salvar. Consulte a documentação oficial de [import CSV do Azure Boards](https://learn.microsoft.com/en-us/azure/devops/boards/queries/import-work-items-from-csv?view=azure-devops).",
        "",
        "## Evidências usadas",
        "",
    ]
    for reference in data["references"]:
        if reference.get("url"):
            lines.append(f"- [{reference['label']}]({reference['url']})")
        else:
            lines.append(f"- [{reference['label']}]({reference['path']})")
    lines += [
        "",
        "## Entrega da atividade",
        "",
        "Após publicar o plano, registre o link Azure DevOps nesta linha: **Link do projeto:** a inserir após a publicação.",
        "",
        "Confirme no projeto cloud os cinco critérios de 20% do PDF: hierarquia de backlog; descrições, critérios de aceite e pronto em BDD; prioridade, esforço, dependências e ordenação; release plan; e tarefas detalhadas da Sprint atual.",
        "",
    ]
    return "\n".join(lines)


def main():
    data = load_data()
    validate_data(data)
    imported = write_import_csv(data)
    PLAN.write_text(render_plan(data), encoding="utf-8")
    totals = point_totals(data)
    kinds = defaultdict(int)
    for row in imported:
        kinds[row["Work Item Type"]] += 1
    print(f"Gerado: {PLAN.relative_to(ROOT)}")
    print(f"Gerado: {IMPORT.relative_to(ROOT)}")
    print("Pontos por Sprint: " + ", ".join(f"{name}={points}" for name, points in totals.items()))
    print("Itens CSV: " + ", ".join(f"{kind}={count}" for kind, count in sorted(kinds.items())))


if __name__ == "__main__":
    main()
