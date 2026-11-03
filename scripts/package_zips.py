import os
import zipfile

def create_zip(source_dir, output_zip_path, exclude_dirs=None, exclude_files=None, prefix_strip=""):
    exclude_dirs = set(exclude_dirs or [])
    exclude_files = set(exclude_files or [])
    
    os.makedirs(os.path.dirname(output_zip_path), exist_ok=True)
    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Filtrar carpetas excluidas en el recorrido
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.git')]
            
            for file in files:
                if file in exclude_files or file.endswith('.pyc') or file.endswith('.zip'):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, prefix_strip if prefix_strip else source_dir)
                zipf.write(file_path, rel_path)

if __name__ == "__main__":
    base_dir = "/app/applet"
    public_dir = os.path.join(base_dir, "public")
    
    # 1. Empaquetar MineSafe Web
    web_zip = os.path.join(public_dir, "minesafe-web.zip")
    web_zip_compat = os.path.join(public_dir, "minesafe-web-ia.zip")
    print(f"Empaquetando proyecto Web en {web_zip}...")
    create_zip(
        source_dir=base_dir,
        output_zip_path=web_zip,
        exclude_dirs={"node_modules", "dist", ".git", ".pytest_cache", "minesafe-ai", "__pycache__"},
        exclude_files={"minesafe-web.zip", "minesafe-web-ia.zip", "minesafe-ai-actualizado.zip"},
        prefix_strip=base_dir
    )
    import shutil
    shutil.copyfile(web_zip, web_zip_compat)
    print(f"Web ZIP creado con tamaño: {os.path.getsize(web_zip)} bytes")

