import csv as csvlib


def csv_to_timetable_json(csv_file, base_url):
    routes = {}
    with open(csv_file, encoding='utf-8', newline='') as f:
        reader = csvlib.DictReader(f, delimiter=';')
        for row in reader:
            ref = row['Haltestellenname'].rstrip()
            if ref not in routes:
                routes[ref] = {}

            line = row['Linie']
            if line not in routes[ref]:
                routes[ref][line] = {'files': []}

            routes[ref][line]['files'].append({
                'title': row.get('Richtungsüberschrift', '').rstrip(),
                'url': f"{base_url}{row['Datei'].lower()}"
            })

    return routes


def create_night_timetable_json(csv_file, base_url):
    routes = {}
    with open(csv_file, encoding='utf-8', newline='') as f:
        reader = csvlib.DictReader(f, delimiter=';')
        for row in reader:
            line = row['Line']
            routes[line] = {
                'files': {'url': f"{base_url}{row['File']}"}
            }
    return routes
