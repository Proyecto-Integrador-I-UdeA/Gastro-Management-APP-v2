export default function Topbar({ title }: { title: string }) {
  return (
    <header className="topbar">
      <h2 className="page-title">{title}</h2>
      
      <div className="topbar-right">
        <div className="user-profile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://i.pravatar.cc/150?u=pedro" alt="Pedro Ramiro" className="avatar" />
          <div className="user-info">
            <strong>Pedro Ramiro</strong> | Jefe de Compras
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn"><i className="fa-regular fa-bell"></i></button>
          <button className="icon-btn"><i className="fa-solid fa-arrow-right-from-bracket"></i></button>
        </div>
      </div>
    </header>
  );
}
