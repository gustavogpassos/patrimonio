from authentik.core.models import Group, User
from authentik.providers.oauth2.models import ScopeMapping

def member(username, group_name):
    user, _ = User.objects.get_or_create(
        username=username,
        defaults={"name": username, "email": username + "@localhost"},
    )
    group = Group.objects.get(name=group_name)
    if not group.users.filter(pk=user.pk).exists():
        group.users.add(user)
    return user

almox = member("probe-almoxarifado", "setor-almoxarifado")
names = {group.name for group in almox.all_groups()}
needed = {"wiki", "wiki-almoxarifado", "chamados", "setor-almoxarifado"}
missing = needed - names
if missing:
    raise SystemExit("FAIL almox missing " + ",".join(sorted(missing)))
if "wiki-financeiro-editar" in names or "patrimonio" in names:
    raise SystemExit("FAIL almox has forbidden group")

ti = member("probe-ti", "setor-ti")
ti_names = {group.name for group in ti.all_groups()}
if "patrimonio" not in ti_names:
    raise SystemExit("FAIL ti missing patrimonio")

mapping = ScopeMapping.objects.get(name="intranet-groups")
almox_claim = set(mapping.evaluate(user=almox, request=None)["groups"])
if not {"wiki", "wiki-almoxarifado", "chamados"}.issubset(almox_claim):
    raise SystemExit("FAIL claim almox " + ",".join(sorted(almox_claim)))
if "wiki-financeiro-editar" in almox_claim or "patrimonio" in almox_claim:
    raise SystemExit("FAIL claim almox forbidden")
ti_claim = set(mapping.evaluate(user=ti, request=None)["groups"])
if "patrimonio" not in ti_claim:
    raise SystemExit("FAIL claim ti missing patrimonio")
print("OK effective-groups")
